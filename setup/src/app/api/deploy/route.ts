import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(process.cwd(), '..');

export async function POST(req: NextRequest) {
  const { stripeSecretKey, awsAccessKeyId, awsSecretAccessKey, awsRegion, stackName,
    merchantName, personaName, personaDescription } =
    await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line })}\n\n`));
      };

      // First store Stripe secret in SSM
      const ssmArgs = [
        'ssm', 'put-parameter',
        '--name', `/onsite-concierge/stripe-secret-key`,
        '--type', 'SecureString',
        '--value', stripeSecretKey,
        '--overwrite',
        '--region', awsRegion || 'us-east-1',
      ];

      const env = {
        ...process.env,
        AWS_ACCESS_KEY_ID: awsAccessKeyId,
        AWS_SECRET_ACCESS_KEY: awsSecretAccessKey,
        AWS_DEFAULT_REGION: awsRegion || 'us-east-1',
        DEPLOY_MERCHANT_NAME: merchantName || '',
        DEPLOY_PERSONA_NAME: personaName || '',
        DEPLOY_PERSONA_DESCRIPTION: personaDescription || '',
      };

      send('Storing Stripe secret in AWS SSM...');

      const ssm = spawn('aws', ssmArgs, { env });
      ssm.stderr.on('data', (d) => send(d.toString().trim()));
      ssm.on('close', (code) => {
        if (code !== 0) {
          send(`SSM error (exit ${code}) — check your AWS credentials`);
          controller.close();
          return;
        }
        send('Stripe secret stored ✓');
        send('');
        send('Running deploy.sh...');

        const deploy = spawn('bash', ['deploy.sh'], {
          cwd: resolve(ROOT, 'infrastructure'),
          env,
        });

        deploy.stdout.on('data', (d) => {
          d.toString().split('\n').filter(Boolean).forEach((l: string) => send(l));
        });
        deploy.stderr.on('data', (d) => {
          d.toString().split('\n').filter(Boolean).forEach((l: string) => send(l));
        });
        deploy.on('close', (deployCode) => {
          if (deployCode === 0) {
            send('');
            send('✅ Deployment complete!');
          } else {
            send(`❌ Deploy failed (exit ${deployCode})`);
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, ok: deployCode === 0 })}\n\n`));
          controller.close();
        });
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
