import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  PlusCircle,
  Trash2,
  XCircle,
} from "lucide-react";

interface Advertisement {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  created_at: string;
  valid_until?: string;
}

export function AdvertisementManagement() {
  const { profile } = useAuth();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const uploadProgressTimerRef = useRef<number | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  const now = new Date();
  const isEditing = !!editingAdId;
  const isFormVisible = showForm || isEditing;
  const activeAds = ads.filter((ad) => !ad.valid_until || new Date(ad.valid_until) >= now);
  const expiredAds = ads.filter((ad) => ad.valid_until && new Date(ad.valid_until) < now);

  const fetchRestaurantId = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", profile.id)
      .single();

    if (error || !data) {
      console.error("Restaurant not found:", error);
      return;
    }
    setRestaurantId(data.id);
    return data.id;
  };

  const fetchAds = async () => {
    const resId = restaurantId || (await fetchRestaurantId());
    if (!resId) return;

    const { data, error } = await supabase
      .from("advertisements")
      .select("*")
      .eq("restaurant_id", resId)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setAds(data as Advertisement[]);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setValidUntil("");
    setImageFile(null);
    setPreviewImageUrl(null);
    setEditingAdId(null);
    setShowForm(false);
    setUploadProgress(0);
  };

  const beginFakeUploadProgress = () => {
    setUploadProgress(8);
    if (uploadProgressTimerRef.current) {
      window.clearInterval(uploadProgressTimerRef.current);
    }

    uploadProgressTimerRef.current = window.setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        const jump = Math.floor(Math.random() * 8) + 3;
        return Math.min(90, prev + jump);
      });
    }, 250);
  };

  const endFakeUploadProgress = (isSuccess: boolean) => {
    if (uploadProgressTimerRef.current) {
      window.clearInterval(uploadProgressTimerRef.current);
      uploadProgressTimerRef.current = null;
    }

    if (!isSuccess) {
      setUploadProgress(0);
      return;
    }

    setUploadProgress(100);
    window.setTimeout(() => setUploadProgress(0), 400);
  };

  const applyImageFile = (file: File | null) => {
    setImageFile(file);
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    if (lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current);
    }
    lastBlobUrlRef.current = objectUrl;
    setPreviewImageUrl(objectUrl);
  };

  const handleDropImage: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const droppedFile = e.dataTransfer.files?.[0] ?? null;
    if (!droppedFile) return;
    if (!droppedFile.type.startsWith("image/")) {
      alert("Please drop an image file only.");
      return;
    }
    applyImageFile(droppedFile);
  };

  const handleStartEditAd = (ad: Advertisement) => {
    setShowForm(true);
    setEditingAdId(ad.id);
    setTitle(ad.title || "");
    setDescription(ad.description || "");
    setValidUntil(ad.valid_until ? new Date(ad.valid_until).toISOString().slice(0, 10) : "");
    setImageFile(null);
    setPreviewImageUrl(ad.image_url || null);
    setUploadProgress(0);
  };

  const handleSubmitAd = async () => {
    if (!profile || !title || !description) return;
    setLoading(true);

    const resId = restaurantId || (await fetchRestaurantId());
    if (!resId) {
      setLoading(false);
      alert("Restaurant not found.");
      return;
    }

    const adBeingEdited = isEditing ? ads.find((ad) => ad.id === editingAdId) : null;
    let imageUrl = adBeingEdited?.image_url ?? null;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `restaurant-${resId}/${fileName}`;

      beginFakeUploadProgress();

      const { error: uploadError } = await supabase.storage
        .from("ad-images")
        .upload(filePath, imageFile);

      if (uploadError) {
        // Surface upload details and abort the advertisement creation so
        // we don't attempt to insert a DB row when storage failed.
        console.error("Image upload error:", uploadError);
        setLoading(false);
        alert(
          `Image upload failed: ${uploadError.message || JSON.stringify(uploadError)} (status: ${
            // @ts-ignore
            uploadError.status || "unknown"
          })`
        );
        endFakeUploadProgress(false);
        return;
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("ad-images")
          .getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
        endFakeUploadProgress(true);
      }
    }

    const payload = {
      restaurant_id: resId,
      title,
      description,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      image_url: imageUrl,
    };

    const { error } = isEditing
      ? await supabase.from("advertisements").update(payload).eq("id", editingAdId)
      : await supabase.from("advertisements").insert([payload]);

    if (error) {
      console.error(error);
      // Clear loading before alerting
      setLoading(false);
      if ((error as any)?.code === "42501") {
        alert(
          "Insert blocked by Row Level Security: you may not have permission to create advertisements for this restaurant. Ensure you are authenticated and are the owner of the restaurant."
        );
      } else {
        alert(`Failed to create advertisement: ${error.message || JSON.stringify(error)}`);
      }
      return;
    }

    resetForm();
    fetchAds();
    setLoading(false);
  };

  // Improve feedback for RLS failures by wrapping the insert and showing
  // a user-friendly message if the database rejects the insert due to
  // row level security. (This mirrors the console error but is clearer.)

  const handleDeleteAd = async (adId: string) => {
    const confirmed = window.confirm("Delete this advertisement?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("advertisements")
      .delete()
      .eq("id", adId);

    if (error) console.error(error);
    else fetchAds();
  };

  useEffect(() => {
    fetchAds();
  }, [profile, restaurantId]);

  useEffect(() => {
    return () => {
      if (uploadProgressTimerRef.current) {
        window.clearInterval(uploadProgressTimerRef.current);
      }
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/40 to-white p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800">
                <Megaphone className="h-3.5 w-3.5" />
                Campaign Studio
              </p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Advertisement Management</h1>
              <p className="text-sm text-slate-600 md:text-base">
                Launch polished promotions for your restaurant and keep your menu visible to more customers.
              </p>
            </div>

            <Link
              to="/restaurant"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{isEditing ? "Edit Campaign" : "Create New Campaign"}</h2>
                <p className="mt-1 text-sm text-slate-600">Craft a high-converting ad with strong copy and clear visuals.</p>
              </div>
              {!isFormVisible && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Press to Add Promo
                </button>
              )}
              {isFormVisible && (
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <XCircle className="h-4 w-4" />
                  {isEditing ? 'Cancel Edit' : 'Close Form'}
                </button>
              )}
            </div>

            {isFormVisible && (
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Campaign Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Example: Weekend Family Feast"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell customers what makes this offer worth ordering now..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Valid Until</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Image</label>
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={handleDropImage}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition ${
                      isDraggingImage
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-300 text-slate-600 hover:border-emerald-400 hover:bg-emerald-50/40"
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span className="truncate">
                      {imageFile
                        ? imageFile.name
                        : isEditing
                          ? "Replace campaign image (optional)"
                          : "Upload campaign image or drag & drop"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => applyImageFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>Uploading image...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitAd}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                disabled={loading}
              >
                <PlusCircle className="h-4 w-4" />
                {loading ? (isEditing ? "Saving..." : "Publishing...") : (isEditing ? "Save Changes" : "Publish Advertisement")}
              </button>
            </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Campaigns</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{ads.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Active</p>
              <p className="mt-2 text-3xl font-bold text-emerald-800">{activeAds.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-amber-700">Expired</p>
              <p className="mt-2 text-3xl font-bold text-amber-800">{expiredAds.length}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <div className="h-28 bg-slate-100">
                  {previewImageUrl ? (
                    <img src={previewImageUrl} alt="Campaign preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">{title || "Campaign title"}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{description || "Campaign description will appear here."}</p>
                  <p className="pt-1 text-[11px] text-slate-500">
                    {validUntil ? `Valid until: ${new Date(validUntil).toLocaleDateString()}` : "No expiry date set"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Live Campaigns</h2>
          </div>

          {ads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
              No advertisements yet. Create your first campaign above.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ads.map((ad) => {
                const isExpired = !!ad.valid_until && new Date(ad.valid_until) < now;
                return (
                  <article key={ad.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                    <div className="relative h-40 w-full bg-slate-100">
                      {ad.image_url ? (
                        <img src={ad.image_url} alt={ad.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <ImageIcon className="h-7 w-7" />
                        </div>
                      )}
                      <span
                        className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isExpired ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {isExpired ? "Expired" : "Active"}
                      </span>
                    </div>

                    <div className="space-y-2 p-4">
                      <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{ad.title}</h3>
                      <p className="line-clamp-2 text-sm text-slate-600">{ad.description}</p>

                      <div className="pt-1 text-xs text-slate-500">
                        <p>Created: {new Date(ad.created_at).toLocaleDateString()}</p>
                        <p>
                          Valid until: {ad.valid_until ? new Date(ad.valid_until).toLocaleDateString() : "No expiry"}
                        </p>
                      </div>

                      <button
                        onClick={() => handleStartEditAd(ad)}
                        className="mt-2 mr-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAd(ad.id)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}