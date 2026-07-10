import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Box,
  Image as ImageIcon,
  Pencil,
  PlusCircle,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  quantity: number;
  image_url?: string;
  created_at?: string;
}

export function MenuManagement() {
  const { profile } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const progressTimerRef = useRef<number | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  const isEditing = !!editingItemId;
  const isFormVisible = showForm || isEditing;

  const parseAmount = (value: string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const resetForm = () => {
    setName("");
    setCategory("");
    setDescription("");
    setPrice("");
    setQuantity("");
    setImageFile(null);
    setEditingItemId(null);
    setShowForm(false);
    setPreviewImageUrl(null);
    setUploadProgress(0);
  };

  const beginFakeUploadProgress = () => {
    setUploadProgress(8);
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = window.setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return Math.min(90, prev + Math.floor(Math.random() * 8) + 3);
      });
    }, 240);
  };

  const endFakeUploadProgress = (success: boolean) => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (!success) {
      setUploadProgress(0);
      return;
    }

    setUploadProgress(100);
    window.setTimeout(() => setUploadProgress(0), 450);
  };

  const applyImageFile = (file: File | null) => {
    setImageFile(file);
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    if (lastBlobUrlRef.current) URL.revokeObjectURL(lastBlobUrlRef.current);
    lastBlobUrlRef.current = objectUrl;
    setPreviewImageUrl(objectUrl);
  };

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

  const fetchMenu = async () => {
    const resId = restaurantId || (await fetchRestaurantId());
    if (!resId) return;

    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", resId)
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    else setMenuItems(data as MenuItem[]);
  };

  const handleStartEdit = (item: MenuItem) => {
    setShowForm(true);
    setEditingItemId(item.id);
    setName(item.name || "");
    setCategory(item.category || "");
    setDescription(item.description || "");
    setPrice(String(item.price ?? ""));
    setQuantity(String(item.quantity ?? ""));
    setImageFile(null);
    setPreviewImageUrl(item.image_url || null);
    setUploadProgress(0);
  };

  const handleSubmitItem = async () => {
    if (!profile || !name.trim() || !category.trim() || price.trim() === "") return;
    setLoading(true);

    const resId = restaurantId || (await fetchRestaurantId());
    if (!resId) {
      setLoading(false);
      alert("Restaurant not found.");
      return;
    }

    const editingItem = isEditing ? menuItems.find((item) => item.id === editingItemId) : null;
    let imageUrl = editingItem?.image_url ?? null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `restaurant-${resId}/${fileName}`;

      beginFakeUploadProgress();

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error("Image upload error:", uploadError);
        endFakeUploadProgress(false);
        setLoading(false);
        alert(`Image upload failed: ${uploadError.message || JSON.stringify(uploadError)}`);
        return;
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
        endFakeUploadProgress(true);
      }
    }

    const payload = {
      restaurant_id: resId,
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: parseAmount(price),
      quantity: parseAmount(quantity),
      image_url: imageUrl,
    };

    const { error } = isEditing
      ? await supabase.from("menus").update(payload).eq("id", editingItemId)
      : await supabase.from("menus").insert([payload]);

    if (error) console.error(error);
    else {
      resetForm();
      fetchMenu();
    }

    setLoading(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    const confirmed = window.confirm("Delete this menu item?");
    if (!confirmed) return;

    const { error } = await supabase.from("menus").delete().eq("id", itemId);
    if (error) console.error(error);
    else fetchMenu();
  };

  useEffect(() => {
    fetchMenu();
  }, [profile, restaurantId]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      if (lastBlobUrlRef.current) URL.revokeObjectURL(lastBlobUrlRef.current);
    };
  }, []);

  const handleDropImage: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (!dropped) return;
    if (!dropped.type.startsWith("image/")) {
      alert("Please drop an image file.");
      return;
    }
    applyImageFile(dropped);
  };

  const lowStockItems = menuItems.filter((item) => item.quantity <= 5).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-white p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold tracking-wide text-sky-800">
                <Box className="h-3.5 w-3.5" />
                Inventory Studio
              </p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Menu Item Management</h1>
              <p className="text-sm text-slate-600 md:text-base">Create, edit, and optimize your item catalog with rich previews and media uploads.</p>
            </div>

            <Link to="/restaurant" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{isEditing ? "Edit Item" : "Create New Item"}</h2>
                <p className="mt-1 text-sm text-slate-600">Use clear titles, strong category tags, and photos that sell.</p>
              </div>
              {!isFormVisible && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                >
                  <PlusCircle className="h-4 w-4" />
                  Press to Add Item
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Example: Burgers"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Item Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Example: Double Smash Burger"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe ingredients and what makes this item special"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Price (R)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Stock Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Item Image</label>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragLeave={() => setIsDraggingImage(false)}
                  onDrop={handleDropImage}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm transition ${
                    isDraggingImage
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-300 text-slate-600 hover:border-sky-400 hover:bg-sky-50/40"
                  }`}
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="truncate">
                    {imageFile
                      ? imageFile.name
                      : isEditing
                        ? "Replace item image (optional)"
                        : "Upload item image or drag & drop"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => applyImageFile(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadProgress > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>Uploading image...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitItem}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                disabled={loading}
              >
                {isEditing ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                {loading ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save Item Changes" : "Add Item")}
              </button>
            </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Items</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{menuItems.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-amber-700">Low Stock</p>
              <p className="mt-2 text-3xl font-bold text-amber-800">{lowStockItems}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <div className="h-28 bg-slate-100">
                  {previewImageUrl ? (
                    <img src={previewImageUrl} alt="Item preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">{name || "Item name"}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{description || "Item description preview."}</p>
                  <div className="pt-1 text-[11px] text-slate-500">
                    <span className="mr-2">{category || "Category"}</span>
                    <span className="mr-2">R{(parseAmount(price) || 0).toFixed(2)}</span>
                    <span>Qty: {parseAmount(quantity) || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Inventory Items</h2>
          </div>

          {menuItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
              No menu items yet. Add your first item above.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="relative h-40 w-full bg-slate-100">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-7 w-7" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      {item.category || "Uncategorized"}
                    </span>
                  </div>

                  <div className="space-y-2 p-4">
                    <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{item.name}</h3>
                    <p className="line-clamp-2 text-sm text-slate-600">{item.description}</p>

                    <div className="pt-1 text-xs text-slate-500">
                      <p>Price: R{Number(item.price || 0).toFixed(2)}</p>
                      <p>Stock: {item.quantity}</p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}