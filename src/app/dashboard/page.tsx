// src/app/dashboard/page.tsx

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PROPERTIES, Property } from "@/lib/properties-data";
import {
  getCachedUser,
  setCachedUser,
  getSavedPropertyIds,
  toggleSavedPropertyId,
  AUTH_CHANGE_EVENT,
  SAVED_CHANGE_EVENT,
} from "@/lib/auth-cache";
import { createClient } from "@/utils/supabase/client";

interface AlertItem {
  name: string;
  detail: string;
  on: boolean;
}

interface ListingItem {
  title: string;
  type: string;
  city: string;
  price: string;
  beds: string;
  status: string;
}

interface MessageThread {
  name: string;
  topic: string;
  messages: [string, string][];
}

function UserDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get("view") || "overview";

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [avatarInput, setAvatarInput] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  // Dynamic Dashboard Stats
  const [memberSince, setMemberSince] = useState<Date | null>(null);
  const [accountStatus, setAccountStatus] = useState("Active");
  const [accountVerification, setAccountVerification] = useState("Verified account");
  const [liveListingsCount, setLiveListingsCount] = useState(0);
  const [draftListingsCount, setDraftListingsCount] = useState(0);


  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      name: "3-bedroom homes in Mumbai",
      detail: "Buy · Apartment or villa · ₹ 2 Cr to ₹ 10 Cr",
      on: true,
    },
    {
      name: "Villas in Goa",
      detail: "Rent · 3+ bedrooms · Any budget",
      on: true,
    },
  ]);
  const [listings, setListings] = useState<ListingItem[]>([
    {
      title: "Bandra Atelier",
      type: "Apartment",
      city: "Mumbai",
      price: "₹ 98k / mo",
      beds: "2",
      status: "Live",
    },
  ]);
  const [messages, setMessages] = useState<MessageThread[]>([
    {
      name: "Maya · Property advisor",
      topic: "Skyline Residences",
      messages: [
        [
          "advisor",
          "Hello Aarav, I can help arrange a viewing for Skyline Residences.",
        ],
        ["you", "Thank you. I would like to see it this weekend."],
      ],
    },
  ]);
  const [activeThread, setActiveThread] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);

  // Modals state
  const [modalType, setModalType] = useState<
    "alert" | "listing" | "message" | null
  >(null);
  const [alertName, setAlertName] = useState("");
  const [alertPurpose, setAlertPurpose] = useState("Buy");
  const [alertType, setAlertType] = useState("Apartment");
  const [alertArea, setAlertArea] = useState("");
  const [listTitle, setListTitle] = useState("");
  const [listType, setListType] = useState("Apartment");
  const [listCity, setListCity] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [listBeds, setListBeds] = useState("2");
  const [msgTopic, setMsgTopic] = useState("");
  const [msgText, setMsgText] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const savedProperties = PROPERTIES.filter((p) => savedIds.includes(p.id));
  const activeThreadData = messages[activeThread] || messages[0];

  const viewTitles: Record<string, string> = {
    overview: "Home base",
    saved: "Saved spaces",
    alerts: "Match alerts",
    messages: "Conversations",
    sell: "Sell a property",
    settings: "Account studio",
  };

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select(
            "full_name, phone, agency_name, bio, verification_status, logo_url, created_at, role",
          )
          .eq("id", user.id)
          .single();

        const fullName =
          profile?.full_name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "";
        const phone = profile?.phone || user.user_metadata?.phone || "";
        const email = user.email || "";

        setUserName(fullName);
        setNameInput(fullName);
        setUserEmail(email);
        setEmailInput(email);
        setPhoneInput(phone);
        setLocationInput("");

        const cached = getCachedUser();
        if (cached?.avatar?.startsWith("data:image")) {
          setUserAvatar(cached.avatar);
          setAvatarInput(cached.avatar);
        }

        setCachedUser({
          name: fullName,
          email,
          role: profile?.verification_status || cached?.role || "buyer",
          avatar: cached?.avatar || "",
          location: cached?.location || "",
        });

        // Set dynamic stats
        if (profile?.created_at) {
          setMemberSince(new Date(profile.created_at));
        } else if (user.created_at) {
          setMemberSince(new Date(user.created_at));
        }

        if (profile?.verification_status === "verified") {
          setAccountStatus("Active");
          setAccountVerification("Verified account");
        } else {
          setAccountStatus("Pending");
          setAccountVerification(
            profile?.verification_status
              ? profile.verification_status.charAt(0).toUpperCase() +
              profile.verification_status.slice(1) + " account"
              : "Unverified account"
          );
        }

        // Fetch properties for counts
        const { data: submissions } = await supabase
          .from("property_submissions")
          .select("status")
          .eq("owner_id", user.id);

        if (submissions) {
          const live = submissions.filter((s) => s.status === "approved").length;
          const draft = submissions.length - live;
          setLiveListingsCount(live);
          setDraftListingsCount(draft);
        }

        // Fetch notification count for this user's role
        const { data: profileForRole } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const userRole = profileForRole?.role || "user";

        const { count } = await supabase
          .from("admin_notifications")
          .select("*", { count: "exact", head: true })
          .or(`target_role.eq.all,target_role.eq.${userRole}`);

        setNotificationCount(count ?? 0);
      }

      setProfileLoading(false);
      setSavedIds(getSavedPropertyIds());
    };

    loadProfile();

    window.addEventListener(AUTH_CHANGE_EVENT, loadProfile);
    window.addEventListener(SAVED_CHANGE_EVENT, () =>
      setSavedIds(getSavedPropertyIds()),
    );

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, loadProfile);
      window.removeEventListener(SAVED_CHANGE_EVENT, () =>
        setSavedIds(getSavedPropertyIds()),
      );
    };
  }, []);

  const showToast = (text: string) => {
    setToastMsg(text);
    setTimeout(() => setToastMsg(""), 2500);
  };

  const switchView = (view: string) => {
    router.push(`/dashboard?view=${view}`);
  };

  const removeSaved = (id: string) => {
    toggleSavedPropertyId(id);
    showToast("Removed from saved spaces.");
  };

  const removeAlert = (idx: number) => {
    setAlerts((prev) => prev.filter((_, i) => i !== idx));
    showToast("Alert removed.");
  };

  const removeListing = (idx: number) => {
    setListings((prev) => prev.filter((_, i) => i !== idx));
    showToast("Listing deleted.");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const updated = [...messages];
    if (updated[activeThread]) {
      updated[activeThread].messages.push(["you", replyText.trim()]);
      setMessages(updated);
      setReplyText("");
      showToast("Message sent.");
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showToast("Not logged in.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: nameInput.trim(),
        phone: phoneInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      showToast("Failed to save: " + error.message);
      return;
    }

    setUserName(nameInput.trim());
    setUserEmail(emailInput);
    if (avatarInput) setUserAvatar(avatarInput);

    setCachedUser({
      name: nameInput.trim(),
      email: emailInput,
      role: getCachedUser()?.role || "buyer",
      avatar: avatarInput,
    });

    showToast("Profile updated successfully.");
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAvatarInput(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    setAlerts([
      {
        name: alertName,
        detail: `${alertPurpose} · ${alertType} · ${alertArea}`,
        on: true,
      },
      ...alerts,
    ]);
    setModalType(null);
    setAlertName("");
    setAlertArea("");
    showToast("Your match alert is active.");
  };

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    setListings([
      {
        title: listTitle,
        type: listType,
        city: listCity,
        price: listPrice,
        beds: listBeds,
        status: "Draft",
      },
      ...listings,
    ]);
    setModalType(null);
    setListTitle("");
    setListCity("");
    setListPrice("");
    showToast("Property saved as a draft.");
  };

  const handleCreateMessage = (e: React.FormEvent) => {
    e.preventDefault();
    setMessages([
      {
        name: "PropertiesNexus Advisor",
        topic: msgTopic,
        messages: [["you", msgText]],
      },
      ...messages,
    ]);
    setModalType(null);
    setMsgTopic("");
    setMsgText("");
    setActiveThread(0);
    showToast("Your enquiry has been sent.");
  };

  return (
    <div className="flex flex-col min-h-screen bg-paper font-sans">
      {/* Top Header Bar */}
      <header className="h-[74px] max-md:h-[63px] bg-white border-b border-line flex items-center px-[clamp(20px,4vw,52px)] max-md:px-[16px] gap-[20px]">
        <span className="text-[12px] text-[#74828d] max-sm:hidden">
          My account / {viewTitles[currentView] || "Home base"}
        </span>
        <nav className="flex gap-[22px] ml-[24px] text-[12px] font-bold text-[#546471] max-md:hidden">
          <Link href="/properties">Properties</Link>
          <Link href="/#areas">Locations</Link>
        </nav>
        <div className="ml-auto flex items-center gap-[11px]">
          <button
            onClick={() => showToast("You have 3 new updates.")}
            className="h-[34px] w-[34px] rounded-full border border-line bg-white text-[#50606d] cursor-pointer flex items-center justify-center font-bold"
            title="Notifications"
          >
            🔔
          </button>
          <button
            onClick={() => switchView("settings")}
            className="border border-line bg-white rounded-[21px] p-[5px_10px_5px_5px] flex items-center gap-[7px] text-[11px] font-bold cursor-pointer hover:bg-gray-50 transition-colors"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="Profile"
                className="h-[27px] w-[27px] rounded-full object-cover"
              />
            ) : (
              <span className="h-[27px] w-[27px] rounded-full bg-gradient-to-br from-[#d7a343] to-[#a76b1d] text-white flex items-center justify-center font-serif text-[13px]">
                {userName.charAt(0)}
              </span>
            )}
            <span className="max-sm:hidden">{userName.split(" ")[0]}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1280px] w-full p-[37px_clamp(20px,4vw,52px)_70px] max-md:p-[25px_16px_55px] mx-auto flex-1">
        {/* OVERVIEW VIEW */}
        {currentView === "overview" && (
          <div>
            {/* At a glance — summary cards */}
            <div className="flex justify-between items-end mb-[14px]">
              <div>
                <p className="m-0 mb-[5px] text-[#a4681c] text-[10px] font-bold tracking-[1.5px] uppercase">
                  Account overview
                </p>
                <h2 className="font-serif text-[28px] font-medium tracking-[-1px] m-0">
                  At a glance
                </h2>
              </div>
              <span className="text-[11px] text-[#798791]">
                Your private account summary
              </span>
            </div>
            <div className="grid grid-cols-4 max-md:grid-cols-2 gap-[14px] max-sm:gap-[9px] mb-[25px]">
              <article className="bg-white border border-line rounded-[20px] shadow-[0_4px_10px_rgba(0,0,0,0.06)] min-h-[146px] p-[17px] max-sm:min-h-[130px] max-sm:p-[13px]">
                <span className="h-[32px] w-[32px] shrink-0 grid place-items-center rounded-full bg-[#eaf1ff] text-[#2c68d9] shadow-[inset_0_0_0_1px_rgba(44,104,217,0.08)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[17px] w-[17px]"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5v5l3.2 2" />
                  </svg>
                </span>

                <p className="text-[11px] text-[#71808a] mt-[14px] mb-[5px]">
                  Property sessions
                </p>
                <b className="block font-serif text-[25px] font-medium text-ink">
                  1
                </b>
                <small className="block mt-[4px] text-[#85929a] text-[10px]">
                  Current signed-in session
                </small>
              </article>
              <article className="bg-white border border-line rounded-[20px] shadow-[0_4px_10px_rgba(0,0,0,0.06)] min-h-[146px] p-[17px] max-sm:min-h-[130px] max-sm:p-[13px]">
                <span className="h-[31px] w-[31px] grid place-items-center rounded-full bg-[#f1f2f0] text-[#68757e] text-[15px]">
                  <i className="ti ti-calendar-event" aria-hidden="true" />
                </span>
                <p className="text-[11px] text-[#71808a] mt-[14px] mb-[5px]">
                  Member since
                </p>
                <b className="block font-serif text-[20px] font-medium text-ink">
                  {memberSince
                    ? memberSince.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                    : "Loading..."}
                </b>
                <small className="block mt-[4px] text-[#85929a] text-[10px]">
                  PropertiesNexus account
                </small>
              </article>
              <article className="bg-white border border-line rounded-[20px] shadow-[0_4px_10px_rgba(0,0,0,0.06)] min-h-[146px] p-[17px] max-sm:min-h-[130px] max-sm:p-[13px]">
                <span className="h-[31px] w-[31px] grid place-items-center rounded-full bg-[#e2faed] text-[#078b58] text-[14px]">
                  ✓
                </span>
                <p className="text-[11px] text-[#71808a] mt-[14px] mb-[5px]">
                  Account status
                </p>
                <b className="block font-serif text-[25px] font-medium text-ink">
                  {accountStatus}
                </b>
                <small className="block mt-[4px] text-[#85929a] text-[10px]">
                  {accountVerification}
                </small>
              </article>
              <article className="bg-white border border-line rounded-[20px] shadow-[0_4px_10px_rgba(0,0,0,0.06)] min-h-[146px] p-[17px] max-sm:min-h-[130px] max-sm:p-[13px]">
                <span className="h-[31px] w-[31px] grid place-items-center rounded-full bg-[#fff2df] text-[#aa701d] text-[14px]">
                  ▦
                </span>
                <p className="text-[11px] text-[#71808a] mt-[14px] mb-[5px]">
                  Properties listed
                </p>
                <b className="block font-serif text-[25px] font-medium text-ink">
                  {liveListingsCount + draftListingsCount}
                </b>
                <small className="block mt-[4px] text-[#85929a] text-[10px]">
                  {liveListingsCount + draftListingsCount > 0
                    ? `${liveListingsCount} live · ${draftListingsCount} draft`
                    : "No active listings"}
                </small>
              </article>
            </div>

            <div className="bg-gradient-to-r from-[#f8ecda] via-[#fff8ed] to-[#ecf2f1] p-[28px_30px] max-sm:p-[23px] border border-[#eadbc5] rounded relative overflow-hidden">
              <p className="text-[10px] uppercase tracking-[1.5px] font-bold text-[#a4681c] m-0 mb-[12px]">
                Your next address, considered
              </p>
              <h1 className="font-serif text-[37px] max-sm:text-[31px] font-medium tracking-[-1.6px] m-0 text-ink">
                Welcome back, {userName.split(" ")[0]}.
              </h1>
              <p className="text-[13px] text-[#596a75] max-w-[500px] leading-[1.65] my-[10px] mb-[20px]">
                Keep your saved homes, property conversations and selling plans
                together in one thoughtful place.
              </p>
              <button
                onClick={() => router.push("/properties")}
                className="border-0 rounded-[7px] bg-navy hover:bg-navy2 !text-white p-[11px_14px] text-[12px] font-bold cursor-pointer transition-colors"
              >
                Continue your search
              </button>
            </div>

            <div className="flex items-end justify-between my-[30px] mb-[15px]">
              <div>
                <h1 className="font-serif text-[34px] max-sm:text-[28px] font-medium tracking-[-1.6px] m-0 text-ink">
                  Your journey today
                </h1>
                <p className="text-[12px] text-muted mt-[7px] mb-0">
                  Small steps that make the next move simpler.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-[14px]">
              <article className="bg-white border border-line p-[17px] min-h-[125px] rounded-[24px] shadow-[0_4px_10px_rgba(0,0,0,0.06)]flex flex-col justify-between">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-[18px] h-[18px] fill-red-500 stroke-red-500"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <div>
                  <b className="block font-serif text-[25px] font-medium my-[13px] mb-[2px] text-ink">
                    {savedIds.length}
                  </b>
                  <span className="text-[10px] text-[#73818c]">
                    Saved spaces
                  </span>
                </div>
              </article>
              <article className="bg-white border border-line p-[17px] min-h-[125px] rounded-[24px] shadow-[0_4px_10px_rgba(0,0,0,0.06)] flex flex-col justify-between">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#477366] stroke-[#477366]" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                </svg>
                <div>
                  <b className="block font-serif text-[25px] font-medium my-[13px] mb-[2px] text-ink">
                    {notificationCount}
                  </b>
                  <span className="text-[10px] text-[#73818c]">
                    Notifications received
                  </span>
                </div>
              </article>
              <article className="bg-white border border-line p-[17px] min-h-[125px] rounded-[24px] shadow-[0_4px_10px_rgba(0,0,0,0.06)] flex flex-col justify-between max-md:col-span-2 max-sm:col-span-1">
                <span className="h-[30px] w-[30px] rounded-full bg-[#edf3f2] flex items-center justify-center">
                  <span className="h-[30px] w-[30px] rounded-full bg-[#edf3f2] text-[#477366] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-[15px] h-[15px] fill-none stroke-[#477366]" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                  </span>
                </span>
                <div>
                  <b className="block font-serif text-[25px] font-medium my-[13px] mb-[2px] text-ink">
                    {alerts.filter((a) => a.on).length}
                  </b>
                  <span className="text-[10px] text-[#73818c]">
                    Active match alerts
                  </span>
                </div>
              </article>
            </div>

            <div className="grid grid-cols-[1.2fr_0.8fr] max-lg:grid-cols-1 gap-[15px] mt-[15px]">
              <section className="bg-white border border-line p-[20px] rounded">
                <div className="flex justify-between items-center mb-[16px]">
                  <h2 className="text-[15px] m-0 font-bold text-ink">
                    Move forward with confidence
                  </h2>
                  <button
                    onClick={() => switchView("alerts")}
                    className="text-[#a36a1c] text-[11px] font-bold border-0 bg-transparent cursor-pointer hover:underline"
                  >
                    Manage alerts →
                  </button>
                </div>
                <div className="grid">
                  <div className="grid grid-cols-[30px_1fr_auto] gap-[10px] items-center py-[13px]">
                    <span className="h-[25px] w-[25px] rounded-full bg-[#f2f4f3] text-[#5c6e75] flex items-center justify-center text-[10px] font-bold">
                      01
                    </span>
                    <div>
                      <b className="text-[12px] font-bold text-ink">
                        Refine your saved areas
                      </b>
                      <p className="text-[10px] text-[#788691] m-0 mt-[3px]">
                        Set a match alert and get notified when something
                        relevant appears.
                      </p>
                    </div>
                    <button
                      onClick={() => switchView("alerts")}
                      className="border-0 bg-transparent text-[#a36a1c] text-[11px] font-bold cursor-pointer hover:underline"
                    >
                      Set alert
                    </button>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_auto] gap-[10px] items-center py-[13px] border-t border-[#edf0f1]">
                    <span className="h-[25px] w-[25px] rounded-full bg-[#f2f4f3] text-[#5c6e75] flex items-center justify-center text-[10px] font-bold">
                      02
                    </span>
                    <div>
                      <b className="text-[12px] font-bold text-ink">
                        Arrange a private viewing
                      </b>
                      <p className="text-[10px] text-[#788691] m-0 mt-[3px]">
                        Choose a saved property and send your request to an
                        advisor.
                      </p>
                    </div>
                    <button
                      onClick={() => switchView("saved")}
                      className="border-0 bg-transparent text-[#a36a1c] text-[11px] font-bold cursor-pointer hover:underline"
                    >
                      View homes
                    </button>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_auto] gap-[10px] items-center py-[13px] border-t border-[#edf0f1]">
                    <span className="h-[25px] w-[25px] rounded-full bg-[#f2f4f3] text-[#5c6e75] flex items-center justify-center text-[10px] font-bold">
                      03
                    </span>
                    <div>
                      <b className="text-[12px] font-bold text-ink">
                        Prepare to sell
                      </b>
                      <p className="text-[10px] text-[#788691] m-0 mt-[3px]">
                        Start a draft listing when you are ready to reach
                        buyers.
                      </p>
                    </div>
                    <button
                      onClick={() => switchView("sell")}
                      className="border-0 bg-transparent text-[#a36a1c] text-[11px] font-bold cursor-pointer hover:underline"
                    >
                      Add property
                    </button>
                  </div>
                </div>
              </section>

              <section className="bg-white border border-line p-[20px] rounded">
                <div className="flex justify-between items-center mb-[16px]">
                  <h2 className="text-[15px] m-0 font-bold text-ink">
                    Latest activity
                  </h2>
                </div>
                <div className="grid gap-[15px]">
                  <div className="pl-[18px] text-[12px] leading-[1.45] text-ink relative">
                    <span className="absolute left-0 top-[5px] h-[8px] w-[8px] rounded-full bg-gold" />
                    A new listing aligns with your Mumbai alert.
                    <small className="block text-[10px] text-[#87949c] mt-[3px]">
                      Today
                    </small>
                  </div>
                  <div className="pl-[18px] text-[12px] leading-[1.45] text-ink relative">
                    <span className="absolute left-0 top-[5px] h-[8px] w-[8px] rounded-full bg-gold" />
                    Your viewing enquiry was received by the property advisor.
                    <small className="block text-[10px] text-[#87949c] mt-[3px]">
                      Yesterday
                    </small>
                  </div>
                  <div className="pl-[18px] text-[12px] leading-[1.45] text-ink relative">
                    <span className="absolute left-0 top-[5px] h-[8px] w-[8px] rounded-full bg-gold" />
                    A saved villa in Goa has a new price.
                    <small className="block text-[10px] text-[#87949c] mt-[3px]">
                      3 days ago
                    </small>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-serif text-xl">
          Loading Account Home Base...
        </div>
      }
    >
      <UserDashboardContent />
    </Suspense>
  );
}