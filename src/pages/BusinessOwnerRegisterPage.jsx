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
  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <form onSubmit={submit} className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm space-y-4">
      <div><p className="text-sm font-medium text-emerald-700">Cohan SaaS</p><h1 className="text-2xl font-bold">Đăng ký chủ doanh nghiệp</h1><p className="text-slate-500">Tạo tài khoản, Brand và chi nhánh đầu tiên trong một bước.</p></div>
      {message && <p className="rounded-xl bg-red-50 p-3 text-red-700">{message}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {[["fullName","Họ tên"],["email","Email"],["phone","Số điện thoại"],["password","Mật khẩu"],["brandName","Tên chuỗi nhà hàng / Brand"],["brandSlug","Slug thương hiệu"],["businessName","Tên pháp lý doanh nghiệp"],["businessTaxCode","Mã số thuế"],["businessEmail","Email doanh nghiệp"],["businessPhone","Số điện thoại doanh nghiệp"],["firstRestaurantName","Tên chi nhánh đầu tiên"],["address","Địa chỉ chi nhánh đầu tiên"]].map(([k,p]) => <label key={k} className="text-sm font-medium text-slate-700">{p}<input required={["fullName","email","password","brandName"].includes(k)} type={k === "password" ? "password" : "text"} className="mt-1 w-full rounded-xl border px-3 py-2" value={form[k]} onChange={set(k)} /></label>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.createFirstRestaurant} onChange={set("createFirstRestaurant")} /> Tạo chi nhánh đầu tiên</label>
      <button disabled={loading} className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{loading ? "Đang đăng ký..." : "Tạo tài khoản chủ doanh nghiệp"}</button>
    </form>
  </main>;
}
