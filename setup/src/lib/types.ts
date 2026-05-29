export interface StoreConfig {
  merchantName: string;
  personaName: string;
  personaDescription: string;
}

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
}

export interface AwsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  stackName: string;
}

export interface ProductOption {
  models?: string[];
  colors?: string[];
  designCategories?: string[];
  customText?: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  options: ProductOption;
}

export interface CatalogConfig {
  storeDescription: string;
  currency: string;
  quickPrompts: string[];
  products: CatalogProduct[];
}

export interface WizardState {
  step: number;
  store: Partial<StoreConfig>;
  catalog: Partial<CatalogConfig>;
  stripe: Partial<StripeConfig>;
  aws: Partial<AwsConfig>;
}
