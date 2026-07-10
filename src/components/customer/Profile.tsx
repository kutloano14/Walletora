import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { ThemeToggle } from "../ThemeToggle";
import { supabase } from "../../lib/supabase";
import { getCurrentPosition, reverseGeocode, searchAddress } from "../../utils/location";

export default function Profile() {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [latitude, setLatitude] = useState(profile?.latitude || "");
  const [longitude, setLongitude] = useState(profile?.longitude || "");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressOptions, setAddressOptions] = useState<Array<{ address: string; latitude: number; longitude: number }>>([]);
  const [message, setMessage] = useState("");

  // Help/complaint form states
  const [orderId, setOrderId] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
      setLatitude(profile.latitude || "");
      setLongitude(profile.longitude || "");
    }
  }, [profile]);

  const handleUpdate = async () => {
    setLoading(true);
    setMessage("");

    try {
      const updates = {
        full_name: fullName,
        phone,
        address,
        latitude,
        longitude,
      };

      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", profile?.id);

      if (error) throw error;

      setMessage("Profile updated successfully!");
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleHelpSubmit = async () => {
    if (!orderId || !description) {
      alert("Please provide Order ID and description.");
      return;
    }

    const subject = `Help / Complaint on Order ID ${orderId}`;
    const body = `Order ID: ${orderId}\nStatus: ${orderStatus}\n\nDescription:\n${description}\n\nUser Contact:\nEmail: ${email}\nPhone: ${phone}`;
    
    const mailtoLink = `mailto:support@walletora.co.za?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');

    alert('✅ Help email opened. Please send to submit your request.\n\nWe will respond within 24 hours.');
    setOrderId('');
    setOrderStatus('');
    setDescription('');
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setMessage("");
    try {
      const coords = await getCurrentPosition();
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));

      try {
        const resolved = await reverseGeocode(coords);
        setAddress(resolved);
      } catch {
        setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`);
      }

      setMessage("Current location captured. Click Update Profile to save.");
    } catch (err: any) {
      setMessage(err?.message || "Could not access your current location.");
    } finally {
      setLocating(false);
    }
  };

  const handleAddressSearch = async () => {
    if (!addressQuery.trim()) {
      setAddressOptions([]);
      return;
    }

    setSearchingAddress(true);
    setMessage("");
    try {
      const results = await searchAddress(addressQuery);
      setAddressOptions(results);
      if (!results.length) {
        setMessage("No location results found. Try a more specific address.");
      }
    } catch (err: any) {
      setMessage(err?.message || "Address search failed.");
      setAddressOptions([]);
    } finally {
      setSearchingAddress(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-10 px-4 space-y-10">
      {/* Theme Settings Section */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Theme Settings</h2>
        <p className="text-gray-500 mb-6">Customize your app appearance.</p>
        <ThemeToggle variant="profile" />
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Your Profile</h2>
        <p className="text-gray-500 mb-6">Manage your account information and location details.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="mt-2 w-full border-gray-300 rounded-lg bg-gray-100 px-3 py-2 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              placeholder="Enter address"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {locating ? "Getting current location..." : "Use Current Location"}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                placeholder="Search address (street, suburb, city)"
              />
              <button
                type="button"
                onClick={handleAddressSearch}
                disabled={searchingAddress}
                className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {searchingAddress ? "Searching..." : "Search"}
              </button>
            </div>
            {addressOptions.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {addressOptions.map((opt, idx) => (
                  <button
                    key={`${opt.latitude}-${opt.longitude}-${idx}`}
                    type="button"
                    className="block w-full border-b border-gray-100 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setAddress(opt.address);
                      setLatitude(String(opt.latitude));
                      setLongitude(String(opt.longitude));
                      setAddressOptions([]);
                    }}
                  >
                    {opt.address}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Latitude</label>
            <input
              type="text"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              placeholder="Latitude"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Longitude</label>
            <input
              type="text"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
              placeholder="Longitude"
            />
          </div>
        </div>

        {message && <p className="text-green-600 mt-4 font-semibold">{message}</p>}

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-all font-semibold"
        >
          {loading ? "Updating..." : "Update Profile"}
        </button>
      </div>

      {/* Help / Complaint Section */}
      <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Help / Complaint</h2>
        <div className="text-gray-500">
         <p> Having issues with an order? Follow these steps:</p>
          <ul className="list-disc ml-5 mt-2">
            <li>Go to <strong>Wallet</strong> → <strong>Transactions</strong></li>
            <li>Locate the transaction for the order you need help with</li>
            <li>Use the <strong>Order ID</strong> in the form below</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Order ID</label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Enter Order ID"
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">Order Status</label>
            <input
              type="text"
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              placeholder="Current status of the order"
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 px-3 py-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe your issue or request"
              className="mt-2 w-full border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 px-3 py-2"
            />
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          Contact for urgent queries: Phone <strong>0606464828</strong>, Email <strong>support@walletora.co.za</strong>
        </p>

        <button
          onClick={handleHelpSubmit}
          className="mt-4 w-full bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 transition-all font-semibold"
        >
          Send Help Request
        </button>
      </div>
    </div>
  );
}