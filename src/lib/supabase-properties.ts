"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Property,
  PROPERTIES as STATIC_PROPERTIES,
} from "@/lib/properties-data";

/**
 * Formats a numeric price into Indian currency format (e.g., ₹ 8.75 Cr, ₹ 1.45 L)
 */
export function formatDisplayPrice(
  price: number,
  purpose: string,
  period?: string,
): string {
  if (!price || isNaN(price)) return "Price on request";

  let formatted = "";
  if (price >= 10000000) {
    const cr = price / 10000000;
    formatted = `₹ ${cr
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/(\.\d)0$/, "$1")} Cr`;
  } else if (price >= 100000) {
    const lac = price / 100000;
    formatted = `₹ ${lac
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/(\.\d)0$/, "$1")} L`;
  } else if (price >= 1000) {
    const k = price / 1000;
    formatted = `₹ ${k.toFixed(1).replace(/\.0$/, "")}k`;
  } else {
    formatted = `₹ ${price.toLocaleString("en-IN")}`;
  }

  const pLower = purpose?.toLowerCase() || "";
  if (
    pLower === "rent" ||
    pLower === "lease" ||
    period === "monthly" ||
    period === "per month"
  ) {
    return `${formatted} / mo`;
  }
  return formatted;
}

/**
 * Calculates a human-readable relative date string from an ISO timestamp
 */
export function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return "Today";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "1d ago";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}m ago`;
  } catch {
    return "Recently";
  }
}

/**
 * Helper to normalize and capitalize property types and purposes
 */
function capitalize(str?: string): string {
  if (!str) return "";
  const s = str.trim().toLowerCase();
  if (s === "pg" || s === "p.g.") return "PG";
  if (s === "builder_floor" || s === "builder floor") return "Builder floor";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Helper to ensure a media path is a fully qualified public URL
 */
function resolveMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";
  const trimmed = pathOrUrl.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ebfijmvsqywngxdhgndo.supabase.co";
  return `${supabaseUrl}/storage/v1/object/public/property-images/${trimmed}`;
}

/**
 * Converts a raw Supabase property row (with optional joined media) into the frontend Property interface
 */
export function transformSupabaseProperty(row: any): Property {
  const priceNum = Number(row.price) || 0;
  const rawPurpose = row.intent || row.purpose || "buy";
  let purposeFormatted = capitalize(rawPurpose);
  if (purposeFormatted.toLowerCase() === "sale") purposeFormatted = "Buy";

  const typeFormatted = capitalize(
    row.property_type || row.type || "Apartment",
  );

  // Extract images and videos from joined property_media or property_submission_media
  const mediaList: string[] = [];

  if (Array.isArray(row.property_media)) {
    row.property_media.forEach((m: any) => {
      const url = resolveMediaUrl(m.media_url || m.storage_path);
      if (url) mediaList.push(url);
    });
  }

  if (Array.isArray(row.property_submission_media)) {
    // Sort media by sort_order if present
    const sortedMedia = [...row.property_submission_media].sort(
      (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    sortedMedia.forEach((m: any) => {
      const url = resolveMediaUrl(m.storage_path || m.media_url);
      if (url) mediaList.push(url);
    });
  }

  // Fallback default image if no media uploaded
  const defaultImg =
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=86";
  const image = mediaList.length > 0 ? mediaList[0] : resolveMediaUrl(row.image) || defaultImg;
  const images = mediaList.length > 0 ? mediaList : [image, image, image];

  // Amenities list
  let amenities: string[] = [];
  if (Array.isArray(row.amenities)) {
    amenities = row.amenities;
  } else if (typeof row.amenities === "string") {
    try {
      amenities = JSON.parse(row.amenities);
    } catch {
      amenities = row.amenities
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }
  if (amenities.length === 0) {
    amenities = [
      "Verified listing",
      "Direct contact",
      "Clear documentation",
      "Prime location",
    ];
  }

  // If price period is monthly, purpose should be Rent ("For Rent"); if total, purpose should be Buy ("For Sale")
  const periodNorm = (row.price_period || "").trim().toLowerCase();
  if (periodNorm === "monthly" || periodNorm === "per month" || periodNorm === "month") {
    purposeFormatted = "Rent";
  } else if (periodNorm === "total") {
    purposeFormatted = "Buy";
  }

  return {
    id: row.id || "unknown",
    title: row.title || "Untitled Property",
    city: row.city || "India",
    area: row.location || row.locality || row.address || row.city || "Prime Location",
    type: typeFormatted,
    purpose: purposeFormatted,
    price: priceNum,
    pricePeriod: row.price_period || undefined,
    displayPrice: formatDisplayPrice(
      priceNum,
      purposeFormatted,
      row.price_period,
    ),
    beds: Number(row.bedrooms) || 0,
    baths: Number(row.bathrooms) || 0,
    areaSq: row.area_sqft
      ? `${Number(row.area_sqft).toLocaleString("en-IN")} sq ft`
      : "Area on request",
    tag: row.tag || (row.status === "approved" || row.status === "published" ? "Verified" : "Just listed"),
    date: formatRelativeDate(row.created_at),
    image,
    images,
    description:
      row.description ||
      "A well-positioned property offering modern conveniences, clean design, and immediate connection to local infrastructure.",
    amenities,
    providerName: row.contact_name || undefined,
    providerPhone: row.contact_phone || undefined,
    providerRole: "Verified Owner",
    providerAvatar: row.providerAvatar || undefined,
    owner_id: row.owner_id || row.user_id || undefined,
  };
}

/**
 * Filter static demo listings (only applied to hardcoded mock properties)
 */
function isCleanStaticProperty(prop: Property): boolean {
  if (!prop.title || !prop.city) return false;
  const title = prop.title.toLowerCase().trim();
  const area = (prop.area || "").toLowerCase().trim();
  const city = (prop.city || "").toLowerCase().trim();

  const testKeywords = [
    "test",
    "testing",
    "testts",
    "asdf",
    "qwerty",
    "demo",
    "sample",
    "fake",
    "junk",
    "dummy",
  ];

  for (const kw of testKeywords) {
    if (
      title === kw ||
      title.includes(kw) ||
      area.includes(kw) ||
      city.includes(kw)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Helper to resolve avatar URL
 */
function resolveAvatarUrl(
  pathOrUrl?: string | null,
  supabase?: ReturnType<typeof createClient>
): string | undefined {
  if (!pathOrUrl) return undefined;
  const trimmed = pathOrUrl.trim();
  if (trimmed.includes("photo-1560250097-0b93528c311a")) {
    return undefined;
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  if (supabase) {
    const { data } = supabase.storage.from("avatars").getPublicUrl(trimmed);
    return data.publicUrl;
  }
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ebfijmvsqywngxdhgndo.supabase.co";
  return `${supabaseUrl}/storage/v1/object/public/avatars/${trimmed}`;
}

/**
 * Fetches a single property by ID from Supabase (checking approved submissions & properties table)
 */
async function transformSupabasePropertyWithProfile(
  row: any,
  supabase: ReturnType<typeof createClient>
): Promise<Property> {
  const base = transformSupabaseProperty(row);
  const profile = row.profiles;

  if (!profile) return base;

  const avatarUrl = resolveAvatarUrl(profile.avatar_url, supabase);

  // Map role to display label
  const roleLabel =
    profile.role === "agent"
      ? "Real Estate Agent"
      : profile.role === "builder"
      ? "Builder / Developer"
      : profile.role === "lister"
      ? "Property Lister"
      : profile.role === "admin"
      ? "PropertiesNexus Admin"
      : "Verified Owner";

  return {
    ...base,
    providerName: profile.full_name || base.providerName,
    providerPhone: profile.phone || base.providerPhone,
    providerAvatar: avatarUrl || base.providerAvatar,
    providerRole: roleLabel,
    owner_id: row.owner_id || row.user_id || base.owner_id,
  };
}

export async function fetchPropertyById(id: string): Promise<Property | null> {
  if (!id) return null;
  try {
    const supabase = createClient();

    // 1. Check in property_submissions table — also fetch owner profile
    const { data: sub } = await supabase
      .from("property_submissions")
      .select("*, property_submission_media(*)")
      .eq("id", id)
      .maybeSingle();

    if (sub) {
      let profile = null;
      if (sub.owner_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url, role")
          .eq("id", sub.owner_id)
          .maybeSingle();
        profile = p;
      }
      return transformSupabasePropertyWithProfile({ ...sub, profiles: profile }, supabase);
    }

    // 2. Check in properties table
    const { data: prop } = await supabase
      .from("properties")
      .select("*, property_media(*)")
      .eq("id", id)
      .maybeSingle();

    if (prop) {
      let profile = null;
      const ownerId = prop.owner_id || prop.user_id;
      if (ownerId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url, role")
          .eq("id", ownerId)
          .maybeSingle();
        profile = p;
      }
      return transformSupabasePropertyWithProfile({ ...prop, profiles: profile }, supabase);
    }

    // 3. Fallback to static
    return STATIC_PROPERTIES.find((p) => p.id === id) || null;
  } catch (e) {
    console.error("Error in fetchPropertyById:", e);
    return STATIC_PROPERTIES.find((p) => p.id === id) || null;
  }
}

/**
 * Fetches all live approved properties from Supabase and merges them with clean real estate listings.
 */
export async function fetchAllProperties(): Promise<Property[]> {
  try {
    const supabase = createClient();
    const liveProperties: Property[] = [];

    // 1. Fetch approved property submissions from Supabase
    const { data: approvedSubmissions, error: subError } = await supabase
      .from("property_submissions")
      .select("*, property_submission_media(*)")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (!subError && approvedSubmissions && approvedSubmissions.length > 0) {
      const ownerIds = Array.from(
        new Set(approvedSubmissions.map((s) => s.owner_id).filter(Boolean))
      );

      let profilesMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url, role")
          .in("id", ownerIds);

        if (profilesData) {
          profilesData.forEach((p) => {
            profilesMap[p.id] = p;
          });
        }
      }

      for (const sub of approvedSubmissions) {
        const profile = sub.owner_id ? profilesMap[sub.owner_id] : null;
        const prop = await transformSupabasePropertyWithProfile(
          { ...sub, profiles: profile },
          supabase
        );
        liveProperties.push(prop);
      }
    } else if (subError) {
      console.warn("Could not fetch approved submissions with joined media, trying standalone query:", subError.message);
      // Fallback if relation join failed
      const { data: standaloneSubs } = await supabase
        .from("property_submissions")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (standaloneSubs && standaloneSubs.length > 0) {
        for (const sub of standaloneSubs) {
          const { data: subMedia } = await supabase
            .from("property_submission_media")
            .select("*")
            .eq("submission_id", sub.id)
            .order("sort_order", { ascending: true });

          liveProperties.push(
            transformSupabaseProperty({
              ...sub,
              property_submission_media: subMedia || [],
            })
          );
        }
      }
    }

    // 2. Fetch published properties (if properties table exists)
    try {
      const { data: publishedProperties } = await supabase
        .from("properties")
        .select("*, property_media(*)")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (publishedProperties && publishedProperties.length > 0) {
        publishedProperties.forEach((prop) => {
          liveProperties.push(transformSupabaseProperty(prop));
        });
      }
    } catch {
      // properties table is optional
    }

    const cleanStatic = STATIC_PROPERTIES.filter(isCleanStaticProperty);

    if (liveProperties.length === 0) {
      return cleanStatic;
    }

    // Combine live properties with clean static properties (deduplicating by id and title)
    const existingIds = new Set(liveProperties.map((p) => p.id));
    const existingTitles = new Set(
      liveProperties.map((p) => p.title.toLowerCase().trim()),
    );
    const uniqueStatic = cleanStatic.filter(
      (p) =>
        !existingIds.has(p.id) &&
        !existingTitles.has(p.title.toLowerCase().trim()),
    );

    // Live database approved properties are placed first
    return [...liveProperties, ...uniqueStatic];
  } catch (e) {
    console.error("Error in fetchAllProperties:", e);
    return STATIC_PROPERTIES.filter(isCleanStaticProperty);
  }
}

/**
 * Custom React Hook to load and synchronize properties across the frontend
 */
export function useProperties() {
  const [properties, setProperties] = useState<Property[]>(STATIC_PROPERTIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllProperties();
      setProperties(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load properties:", err);
      setError(err.message || "Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  return { properties, loading, error, refetch: loadProperties };
}

