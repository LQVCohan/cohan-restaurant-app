import React, { useContext, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";

const REGISTER_BUSINESS_OWNER = gql`
  mutation RegisterBusinessOwner($input: RegisterBusinessOwnerInput!) {
    registerBusinessOwner(input: $input) {
      user { id fullName email roleName }
      brand { id name slug }
      restaurant { id name brandId }
      accessToken
      refreshToken
    }
  }
`;

const BUSINESS_REGISTER_FIELDS = [
  { key: "fullName", label: "Họ tên", required: true, autoComplete: "name" },
  { key: "email", label: "Email", required: true, type: "email", autoComplete: "email" },
  { key: "phone", label: "Số điện thoại", type: "tel", autoComplete: "tel" },
  { key: "password", label: "Mật khẩu", required: true, type: "password", autoComplete: "new-password" },
  { key: "brandName", label: "Tên chuỗi nhà hàng / Brand", required: true, autoComplete: "organization" },
  { key: "brandSlug", label: "Slug thương hiệu", autoComplete: "off" },
  { key: "businessName", label: "Tên pháp lý doanh nghiệp", autoComplete: "organization" },
  { key: "businessTaxCode", label: "Mã số thuế", autoComplete: "off" },
  { key: "businessEmail", label: "Email doanh nghiệp", type: "email", autoComplete: "email" },
  { key: "businessPhone", label: "Số điện thoại doanh nghiệp", type: "tel", autoComplete: "tel" },
  { key: "firstRestaurantName", label: "Tên chi nhánh đầu tiên", autoComplete: "organization" },
  { key: "address", label: "Địa chỉ chi nhánh đầu tiên", autoComplete: "street-address" },
];

export default function BusinessOwnerRegisterPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext) || {};
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", brandName: "", brandSlug: "", businessName: "", businessTaxCode: "", businessEmail: "", businessPhone: "", createFirstRestaurant: true, firstRestaurantName: "", address: "" });
  const [message, setMessage] = useState("");
  const [registerOwner, { loading }] = useMutation(REGISTER_BUSINESS_OWNER);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const { address, ...input } = form;
      if (address) input.firstRestaurantAddress = { line1: address, country: "Vietnam" };
      const { data } = await registerOwner({ variables: { input } });
      const payload = data?.registerBusinessOwner;
      if (payload?.accessToken) {
        login?.(payload.accessToken, payload.user);
        navigate("/manager", { replace: true });
        return;
      }
      navigate("/login", { state: { message: "Đăng ký thành công, vui lòng đăng nhập" } });
    } catch (_error) {
      setMessage("Không thể đăng ký. Email hoặc slug thương hiệu có thể đã tồn tại.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10" aria-labelledby="business-register-title">
      <form
        onSubmit={submit}
        className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm space-y-4"
        aria-describedby={message ? "business-register-error" : "business-register-desc"}
      >
        <header>
          <p className="text-sm font-medium text-emerald-700">Cohan SaaS</p>
          <h1 id="business-register-title" className="text-2xl font-bold">Đăng ký chủ doanh nghiệp</h1>
          <p id="business-register-desc" className="text-slate-500">Tạo tài khoản, Brand và chi nhánh đầu tiên trong một bước.</p>
        </header>

        {message && (
          <p id="business-register-error" className="rounded-xl bg-red-50 p-3 text-red-700" role="alert">
            {message}
          </p>
        )}

        <section className="grid gap-3 md:grid-cols-2" aria-label="Thông tin chủ doanh nghiệp và thương hiệu">
          {BUSINESS_REGISTER_FIELDS.map((field) => {
            const fieldId = `business-register-${field.key}`;
            return (
              <label key={field.key} className="text-sm font-medium text-slate-700" htmlFor={fieldId}>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
                <input
                  id={fieldId}
                  required={field.required}
                  type={field.type || "text"}
                  autoComplete={field.autoComplete}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={form[field.key]}
                  onChange={set(field.key)}
                />
              </label>
            );
          })}
        </section>

        <label className="flex items-center gap-2 text-sm" htmlFor="business-register-create-first-restaurant">
          <input
            id="business-register-create-first-restaurant"
            type="checkbox"
            checked={form.createFirstRestaurant}
            onChange={set("createFirstRestaurant")}
          />
          Tạo chi nhánh đầu tiên
        </label>

        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
          {loading ? "Đang đăng ký..." : "Tạo tài khoản chủ doanh nghiệp"}
        </button>
      </form>
    </main>
  );
}
