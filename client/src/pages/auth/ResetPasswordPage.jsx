import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import { FormField, TextInput } from "../../components/ui/FormField";
import api from "../../api/client";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!passwordRule.test(password)) {
      setError("Minimum 8 chars with uppercase, lowercase, and special character.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      toast.success("Password updated successfully.");
      navigate("/");
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card w-full max-w-lg rounded-[2rem] p-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Create a new secure password for your VEMU SAMS account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField label="New Password" error={error}>
            <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
          <FormField label="Confirm Password">
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

