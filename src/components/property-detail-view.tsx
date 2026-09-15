//  src/components/property-detail-view.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { PROPERTIES as STATIC_PROPERTIES, Property } from "@/lib/properties-data";
import { isPropertySaved, toggleSavedPropertyId, SAVED_CHANGE_EVENT, toggleSavedPropertyIdDB } from "@/lib/auth-cache";
import { useProperties, fetchPropertyById } from "@/lib/supabase-properties";
import { createClient } from "@/utils/supabase/client";
import dynamic from "next/dynamic";
import PropertyCard from "@/components/property-card";
import { ChevronDown, ChevronUp } from "lucide-react";

const PropertyMap = dynamic(() => import("@/components/property-map"), { ssr: false });

function TabPanel({ id, activeTab, title, children }: { id: string, activeTab: string, title: string, children: React.ReactNode }) {
  if (id !== activeTab) return null;
  return (
    <div id={id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="font-serif text-[24px] font-medium m-0 text-slate-900 mb-5">{title}</h2>
      {children}
    </div>
  );
}

function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.includes("video") ||
    lower.includes("/property-videos/")
  );
}

export default function PropertyDetailView({ id }: { id?: string }) {
  const { properties, loading } = useProperties();
  const [directProperty, setDirectProperty] = useState<Property | null>(null);
  const [directLoading, setDirectLoading] = useState(false);

  useEffect(() => {
    if (id && !properties.some((p) => p.id === id)) {
      setDirectLoading(true);
      fetchPropertyById(id)
        .then((data) => {
          if (data) setDirectProperty(data);
        })
        .finally(() => {
          setDirectLoading(false);
        });
    }
  }, [id, properties]);

  // Resolve property
  const property: Property | null =
    properties.find((p) => p.id === id) ||
    directProperty ||
    STATIC_PROPERTIES.find((p) => p.id === id) ||
    (!id ? properties[0] || STATIC_PROPERTIES[0] : null);

  const [isSaved, setIsSaved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Add near the top of the component, after existing useState declarations
  const [ownerProfile, setOwnerProfile] = useState<{
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: string | null;
    location: string | null;
    created_at: string | null;
    listings_count: number;
  } | null>(null);

  useEffect(() => {
    if (property) {
      setIsSaved(isPropertySaved(property.id));
      setMsg(`I would like more information about ${property.title}.`);
    }

    const handleSavedChange = () => {
      if (property) setIsSaved(isPropertySaved(property.id));
    };
    window.addEventListener(SAVED_CHANGE_EVENT, handleSavedChange);

    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      // ✅ Fetch owner profile if property has owner_id
      const ownerId = property?.owner_id || (property as any)?.owner_id;
      if (ownerId) {
        // 1. Query profile table for real user data
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url, role, location, created_at")
          .eq("id", ownerId)
          .maybeSingle();

        // 2. Query active listings count for this owner
        const { count: listingsCount } = await supabase
          .from("property_submissions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .eq("status", "approved");

        if (profile) {
          let avatarUrl: string | null = null;
          if (profile.avatar_url) {
            const rawUrl = profile.avatar_url.trim();
            if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")) {
              avatarUrl = rawUrl;
            } else {
              const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(rawUrl);
              avatarUrl = urlData.publicUrl;
            }
          }
          setOwnerProfile({
            ...profile,
            avatar_url: avatarUrl,
            listings_count: listingsCount ?? 1,
          });
        }
      }
    };
    checkUser();

    return () => {
      window.removeEventListener(SAVED_CHANGE_EVENT, handleSavedChange);
    };
  }, [property]);

  if ((loading || directLoading) && !property) {
    return (
      <div className="min-h-screen bg-paper text-ink font-sans">
        <Navbar variant="light" />
        <div className="max-w-[1216px] mx-auto py-20 px-6 animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-[460px] bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/2" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded w-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-paper text-ink font-sans">
        <Navbar variant="light" />
        <div className="max-w-[1216px] mx-auto py-24 px-6 text-center space-y-4">
          <h1 className="font-serif text-3xl font-bold text-slate-900">Property Not Found</h1>
          <p className="text-slate-600 max-w-md mx-auto">
            The property you are looking for is either no longer available or the link is incorrect.
          </p>
          <div className="pt-4">
            <Link
              href="/properties"
              className="inline-block bg-[#07182d] text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
            >
              Browse All Properties →
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  let images =
    property.images && property.images.length > 0
      ? property.images
      : [property.image, property.image, property.image];

  const totalImages = images.length;
  if (!isLoggedIn && images.length > 3) {
    images = images.slice(0, 3);
  }

  const openLightbox = (idx: number) => {
    if (!isLoggedIn && idx >= 3) {
      setCurrentImgIdx(2);
      setModalOpen(true);
      return;
    }
    setCurrentImgIdx(idx);
    setModalOpen(true);
  };

  const nextImg = () => {
    if (!isLoggedIn && currentImgIdx === images.length - 1) return;
    setCurrentImgIdx((prev) => (prev + 1) % images.length);
  };

  const prevImg = () => {
    if (!isLoggedIn && currentImgIdx === 0) return;
    setCurrentImgIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setFeedback("Thank you. An advisor will contact you shortly.");
      setName("");
      setPhone("");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <Navbar variant="light" />

      {/* Head Bar */}
      <section className="max-w-[1216px] w-[calc(100%-48px)] max-md:w-[calc(100%-32px)] mx-auto py-[25px] pb-[15px] flex justify-between items-center">
        <Link
          href="/properties"
          className="text-[13px] font-bold text-muted hover:text-ink transition-colors flex items-center gap-1"
        >
          ← Back to all properties
        </Link>
        <div className="flex gap-[10px]">
          <button
            onClick={() => openLightbox(0)}
            className="border border-line bg-white rounded-[18px] px-[14px] py-[8px] text-[12px] font-bold cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
          >
            ▤ Media Gallery ({images.length})
          </button>
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await toggleSavedPropertyIdDB(property.id);
            }}
            aria-label={`Save ${property.title}`}
            title={isSaved ? "Remove from saved" : "Save property"}
            className={`absolute z-20 right-3 top-3 border-0 rounded-full w-9 h-9 cursor-pointer flex items-center justify-center shadow-md transition-all duration-150 ${isSaved
              ? "bg-white text-red-500 scale-105"
              : "bg-white/90 text-slate-400 hover:text-red-400 hover:bg-white hover:scale-110"
              }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className={`w-[18px] h-[18px] transition-all duration-200 ${isSaved ? "fill-red-500 stroke-red-500" : "fill-transparent stroke-current"
                }`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </section>

      {/* Photo & Video Gallery Grid */}
      <section className="max-w-[1216px] w-[calc(100%-48px)] max-md:w-[calc(100%-32px)] mx-auto grid grid-cols-[1.7fr_1fr] max-md:grid-cols-1 gap-[15px] mb-[40px]">
        <div
          onClick={() => openLightbox(0)}
          className="h-[460px] max-md:h-[280px] rounded-[14px] cursor-pointer hover:opacity-95 transition-opacity pt-[100px] overflow-hidden relative bg-[#0e1f33] shadow-md"
        >
          {isVideoUrl(images[0]) ? (
            <>
              <video
                src={images[0]}
                className="w-full h-full object-cover"
                muted
                autoPlay
                loop
                playsInline
              />
              <span className="absolute bottom-4 left-4 bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-1.5 shadow">
                <span className="text-gold">▶</span> WALKTHROUGH VIDEO
              </span>
            </>
          ) : (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url('${images[0]}')` }}
            />
          )}
        </div>

        <div className="grid grid-rows-2 max-md:grid-rows-1 max-md:grid-cols-2 gap-[15px]">
          <div
            onClick={() => openLightbox(1 % images.length)}
            className="h-full max-md:h-[160px] rounded-[14px] cursor-pointer hover:opacity-95 transition-opacity overflow-hidden relative bg-[#0e1f33] shadow-sm"
          >
            {isVideoUrl(images[1 % images.length]) ? (
              <>
                <video
                  src={images[1 % images.length]}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <span className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded">
                  ▶ VIDEO
                </span>
              </>
            ) : (
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('${images[1 % images.length]}')` }}
              />
            )}
          </div>

          <div
            onClick={() => openLightbox(2 % images.length)}
            className="h-full max-md:h-[160px] rounded-[14px] cursor-pointer hover:opacity-95 transition-opacity overflow-hidden relative bg-[#0e1f33] shadow-sm"
          >
            {isVideoUrl(images[2 % images.length]) ? (
              <video
                src={images[2 % images.length]}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            ) : (
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url('${images[2 % images.length]}')` }}
              />
            )}
            {totalImages > 3 && (
              <div className="absolute inset-0 bg-black/50 rounded-[14px] flex flex-col items-center justify-center text-white font-bold backdrop-blur-[2px]">
                <span className="text-lg">+{totalImages - 3} more</span>
                {!isLoggedIn && <span className="text-[10px] mt-1 bg-[#dc2626] px-2 py-1 rounded">Login to view</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="max-w-[1216px] w-[calc(100%-48px)] max-md:w-[calc(100%-32px)] mx-auto mb-6 border-b border-slate-200">
        <div className="flex gap-8 text-[15px] font-bold overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview" },
            { id: "key-facts", label: "Key Facts" },
            { id: "amenities", label: "Amenities" },
            { id: "location", label: "Location" },
            { id: "costs", label: "Costs" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 whitespace-nowrap transition-colors outline-none cursor-pointer ${activeTab === tab.id
                ? "border-b-2 border-[#dc2626] text-[#dc2626]"
                : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Layout Grid */}
      <main className="max-w-[1216px] w-[calc(100%-48px)] max-md:w-[calc(100%-32px)] mx-auto grid grid-cols-[1fr_380px] max-md:grid-cols-1 gap-[50px] pb-[80px]">
        {/* Main Content */}
        <article>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              {(() => {
                const periodNorm = (property.pricePeriod || (property as any).price_period || "").trim().toLowerCase();
                const isMonthly =
                  periodNorm === "monthly" ||
                  periodNorm === "per month" ||
                  periodNorm === "month" ||
                  (property.displayPrice && (property.displayPrice.includes("/ mo") || property.displayPrice.includes("/mo")));
                const badgeLabel = isMonthly || property.purpose === "Rent" ? "For Rent" : "For Sale";

                return (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                    {badgeLabel} · {property.type}
                  </span>
                );
              })()}
              {property.tag && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                  {property.tag}
                </span>
              )}
            </div>
            <h1 className="font-serif font-medium text-[clamp(30px,3.5vw,40px)] my-[8px] leading-[1.15] text-slate-900">
              {property.title}
            </h1>
            <p className="text-[15px] text-slate-500 m-0 mb-[18px] flex items-center gap-1">
              📍 {property.area}, {property.city}
            </p>
            <div className="text-[32px] font-bold text-slate-900 mb-[10px]">
              {property.displayPrice}
            </div>
          </div>

          <TabPanel title="About This Property" id="overview" activeTab={activeTab}>
            <p className="text-[15px] leading-[1.8] text-slate-600 m-0 whitespace-pre-line">
              {property.description}
            </p>
          </TabPanel>

          <TabPanel title="Key Facts" id="key-facts" activeTab={activeTab}>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-y-3 text-[14px]">
              <div className="flex justify-between py-2 border-b border-slate-200/80 pr-4">
                <span className="text-slate-500 font-medium">Area</span>
                <span className="font-bold text-slate-900">{property.areaSq}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pl-4 max-md:pl-0">
                <span className="text-slate-500 font-medium">Rooms</span>
                <span className="font-bold text-slate-900">{property.beds ? `${property.beds} BHK` : "Studio"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pr-4">
                <span className="text-slate-500 font-medium">Bathrooms</span>
                <span className="font-bold text-slate-900">{property.baths || 1}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pl-4 max-md:pl-0">
                <span className="text-slate-500 font-medium">Loft</span>
                <span className="font-bold text-slate-900">Single floor</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pr-4">
                <span className="text-slate-500 font-medium">Duplex</span>
                <span className="font-bold text-slate-900">Single floor</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pl-4 max-md:pl-0">
                <span className="text-slate-500 font-medium">Full Options</span>
                <span className="font-bold text-emerald-600">Yes</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pr-4">
                <span className="text-slate-500 font-medium">Floor</span>
                <span className="font-bold text-slate-900">Floor 2 of 15</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200/80 pl-4 max-md:pl-0">
                <span className="text-slate-500 font-medium">Move-in Status</span>
                <span className="font-bold text-slate-900">Vacant / Ready</span>
              </div>
            </div>
          </TabPanel>

          <TabPanel title="Amenities & Highlights" id="amenities" activeTab={activeTab}>
            <ul className="m-0 p-0 list-none grid grid-cols-2 max-md:grid-cols-1 gap-[12px]">
              {property.amenities.map((amenity, idx) => (
                <li key={idx} className="text-[14px] text-slate-800 font-medium flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-emerald-600 font-bold">✓</span> {amenity}
                </li>
              ))}
            </ul>
          </TabPanel>

          <TabPanel title="Location & Neighborhood" id="location" activeTab={activeTab}>
            <p className="text-[15px] leading-[1.8] text-slate-600 m-0 mb-4">
              Located at {property.area}, {property.city}. This address is situated close to major business centers, transport links, top educational institutes, and premium lifestyle hubs.
            </p>
            <div className="mb-4">
              <PropertyMap address={property.area} city={property.city} title={property.title} />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.area + ", " + property.city)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-[13px] shadow hover:bg-slate-800 transition-colors"
              style={{ color: "#ffffff" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
              Navigate via Google Maps
            </a>
          </TabPanel>

          <TabPanel title="Costs & Fees" id="costs" activeTab={activeTab}>
            <div className="text-[14px] text-slate-600 space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="font-medium">Base Price</span>
                <span className="font-bold text-slate-900">{property.displayPrice}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="font-medium">Maintenance (Monthly)</span>
                <span className="font-bold text-slate-900">₹ 8,500</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="font-medium">Registration / Stamp Duty</span>
                <span className="font-bold text-slate-900">~6% of base price</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-medium">Brokerage</span>
                <span className="font-bold text-slate-900">Standard 1% to 2% applicable</span>
              </div>
            </div>
          </TabPanel>
        </article>

        {/* Agency / Provider Sidebar Card (Matching Image 5) */}
        <aside id="costs">
          <div className="bg-white border border-slate-200 p-[24px] rounded-2xl sticky top-[95px] shadow-sm">
            {/* Provider Info Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              {(() => {
                const rawPic =
                  ownerProfile?.avatar_url ||
                  property?.providerAvatar ||
                  (property as any)?.providerAvatar;
                const isUnsplashDefault =
                  rawPic && typeof rawPic === "string" && rawPic.includes("photo-1560250097-0b93528c311a");
                const realAvatar = !isUnsplashDefault && rawPic ? rawPic : null;
                const displayName =
                  ownerProfile?.full_name ||
                  property?.providerName ||
                  (property as any)?.providerName ||
                  "PropertiesNexus User";

                return (
                  <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-[#07182d] flex items-center justify-center text-white text-[16px] font-bold">
                    {realAvatar ? (
                      <img
                        src={realAvatar}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                );
              })()}
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[16px] text-slate-900 m-0">
                    {ownerProfile?.full_name || property?.providerName || (property as any)?.providerName || "PropertiesNexus User"}
                  </h3>
                  <span className="text-blue-500 font-bold text-sm" title="Verified Agency">✔</span>
                </div>
                <p className="text-[12px] text-slate-500 m-0 mt-0.5">
                  {ownerProfile?.role === "agent" ? "Real Estate Agent" :
                    ownerProfile?.role === "builder" ? "Builder / Developer" :
                      ownerProfile?.role === "lister" ? "Property Lister" :
                        ownerProfile?.role === "admin" ? "PropertiesNexus Admin" :
                          property?.providerRole || (property as any)?.providerRole || "Property Owner"}
                </p>
              </div>
            </div>

            {/* Provider Stats */}
            <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600 mb-4 pb-4 border-b border-slate-100">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="block font-bold text-slate-900 text-[14px]">
                  {ownerProfile?.listings_count
                    ? `${ownerProfile.listings_count} ${ownerProfile.listings_count === 1 ? "Listing" : "Listings"}`
                    : "1 Listing"}
                </span>
                <span className="text-[11px] text-slate-500">Active Listings</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="block font-bold text-slate-900 text-[14px] truncate">
                  {ownerProfile?.created_at
                    ? `Since ${new Date(ownerProfile.created_at).getFullYear()}`
                    : (ownerProfile?.location || property.city)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {ownerProfile?.created_at ? "Member Since" : "Location"}
                </span>
              </div>
            </div>

            {/* Provider Phone */}
            {(ownerProfile?.phone || (property as any).providerPhone) && (
              <div className="mb-4 pb-4 border-b border-slate-100 flex items-center gap-2">
                <span className="text-xl">📞</span>
                <div>
                  <span className="block text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                    Contact Number
                  </span>
                  <a
                    href={`tel:${ownerProfile?.phone || (property as any).providerPhone}`}
                    className="text-[14px] font-bold text-slate-900 hover:text-[#d49a38] transition-colors"
                  >
                    {ownerProfile?.phone || (property as any).providerPhone}
                  </a>
                </div>
              </div>
            )}

            <p className="text-[12px] text-slate-600 leading-relaxed mb-4">
              {ownerProfile?.role === "agent"
                ? `Hello, I am ${ownerProfile.full_name || property.providerName || "a verified agent"}, representing properties in ${property.city}. Feel free to contact me for scheduling a visit or any questions.`
                : ownerProfile?.role === "builder"
                  ? `Hello, I am ${ownerProfile.full_name || property.providerName || "representing the developer"}, for this project in ${property.city}. Reach out for floor plans and official documentation.`
                  : `Hello, I am ${ownerProfile?.full_name || property.providerName || "the owner"} of this property in ${property.city}. Contact me directly for viewings or further details.`}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Send a message
              </span>

              <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] font-semibold text-slate-700 border border-slate-200/80">
                INQUIRING ABOUT:<br />
                <span className="text-slate-900 font-bold truncate block">{property.title}</span>
              </div>

              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="border border-slate-200 p-3 rounded-xl text-[13px] outline-none bg-slate-50 focus:bg-white focus:border-[#d49a38] transition-all"
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="border border-slate-200 p-3 rounded-xl text-[13px] outline-none bg-slate-50 focus:bg-white focus:border-[#d49a38] transition-all"
              />
              <textarea
                rows={3}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                className="border border-slate-200 p-3 rounded-xl text-[13px] outline-none bg-slate-50 focus:bg-white focus:border-[#d49a38] resize-none transition-all"
              />

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white p-3.5 rounded-xl font-bold text-[13px] cursor-pointer transition-colors shadow-sm disabled:opacity-60"
              >
                {submitting ? "Sending message..." : "Send Message"}
              </button>

              {feedback && (
                <p className="text-[12px] text-emerald-600 font-semibold text-center mt-1" aria-live="polite">
                  {feedback}
                </p>
              )}
            </form>

            {/* WhatsApp */}
            {(ownerProfile?.phone || (property as any).providerPhone) ? (
              <a
                className="block text-center mt-4 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                href={`https://wa.me/${(ownerProfile?.phone || (property as any).providerPhone || "").replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 Chat directly on WhatsApp →
              </a>
            ) : (
              <a
                className="block text-center mt-4 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                href="https://wa.me/919136331992"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 Chat directly on WhatsApp →
              </a>
            )}
          </div>
        </aside>
      </main>

      {/* Recommended Properties Section */}
      <section className="bg-slate-50 py-16 border-t border-slate-200">
        <div className="max-w-[1216px] w-[calc(100%-48px)] max-md:w-[calc(100%-32px)] mx-auto">
          <h2 className="font-serif text-[28px] font-medium text-slate-900 mb-8">
            Recommended Properties
          </h2>
          <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-[19px]">
            {properties
              .filter((p) => p.id !== property.id && (p.city === property.city || p.type === property.type))
              .slice(0, 3)
              .map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {modalOpen && (
        <div className="fixed inset-0 bg-[rgba(2,15,30,0.92)] z-50 flex items-center justify-center p-[20px] backdrop-blur-sm">
          <div className="relative max-w-[1000px] w-full text-center">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute -top-[45px] right-0 bg-transparent border-0 text-white text-[28px] cursor-pointer font-bold hover:opacity-75 transition-opacity"
            >
              ✕
            </button>
            {isVideoUrl(images[currentImgIdx]) ? (
              <video
                src={images[currentImgIdx]}
                controls
                autoPlay
                className="max-h-[80vh] max-w-full rounded-[12px] shadow-[0_25px_50px_rgba(0,0,0,0.5)] inline-block bg-black"
              />
            ) : (
              <img
                src={images[currentImgIdx]}
                alt={property.title}
                className="max-h-[80vh] max-w-full rounded-[12px] shadow-[0_25px_50px_rgba(0,0,0,0.5)] inline-block"
              />
            )}
            <div className="flex justify-center items-center gap-[20px] mt-[18px] text-white font-bold text-[14px]">
              <button
                onClick={prevImg}
                className={`bg-white/20 hover:bg-white/30 border-0 text-white px-[18px] py-[8px] rounded-[20px] cursor-pointer transition-colors shadow ${(!isLoggedIn && currentImgIdx === 0) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!isLoggedIn && currentImgIdx === 0}
              >
                ← Prev
              </button>
              <span className="tracking-widest text-xs uppercase bg-black/40 px-3 py-1 rounded-full">
                {currentImgIdx + 1} / {images.length}
              </span>
              <button
                onClick={nextImg}
                className={`bg-white/20 hover:bg-white/30 border-0 text-white px-[18px] py-[8px] rounded-[20px] cursor-pointer transition-colors shadow ${(!isLoggedIn && currentImgIdx === images.length - 1) ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!isLoggedIn && currentImgIdx === images.length - 1}
              >
                Next →
              </button>
            </div>
            {!isLoggedIn && totalImages > 3 && (
              <div className="mt-4 p-4 bg-slate-900/90 text-white rounded-xl inline-block shadow-lg border border-slate-700 backdrop-blur-md">
                <p className="font-bold text-[14px] m-0">Want to see all {totalImages} photos?</p>
                <p className="text-[12px] text-slate-300 mt-1 mb-3">Please log in or sign up to view the complete media gallery.</p>
                <Link href="/login" className="bg-[#dc2626] hover:bg-[#b91c1c] px-6 py-2 rounded-lg font-bold text-sm shadow transition-colors inline-block text-white no-underline">
                  Log In / Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}