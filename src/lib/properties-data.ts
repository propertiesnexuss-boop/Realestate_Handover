export interface Property {
  id: string;
  title: string;
  city: string;
  area: string;
  type: string;
  purpose: string;
  price: number;
  displayPrice: string;
  beds: number;
  baths: number;
  areaSq: string;
  tag: string;
  date: string;
  image: string;
  images: string[];
  description: string;
  amenities: string[];
  providerName?: string;
  providerRole?: string;
  providerAvatar?: string;
  providerPhone?: string;
  owner_id?: string;
  pricePeriod?: string;
}

export const PROPERTIES: Property[] = [

];
