import React, { useContext, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { AuthContext } from "@/context/AuthContext";
import useBrandManagement, { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";

const CREATE_BRAND = gql`mutation CreateBrand($input: CreateBrandInput!) { createBrand(input: $input) { id name slug } }`;
const UPDATE_BRAND = gql`mutation UpdateBrand($id: ID!, $input: UpdateBrandInput!) { updateBrand(id: $id, input: $input) { id name slug businessName businessEmail businessPhone status } }`;
const CREATE_RESTAURANT = gql`mutation CreateRestaurant($input: CreateRestaurantInput!) { createRestaurant(input: $input) { id name brandId } }`;
const MEMBERS = gql`query BrandMembers($brandId: ID!) { brandMembers(brandId: $brandId) { id role status user { id fullName email } restaurantIds } }`;
const ADD_MEMBER = gql`mutation AddBrandMember($input: AddBrandMemberInput!) { addBrandMember(input: $input) { id } }`;
const UPDATE_MEMBER = gql`mutation UpdateBrandMember($input: UpdateBrandMemberInput!) { updateBrandMember(input: $input) { id role status } }`;

export default function BrandManagement() {
  const { user } = useContext(AuthContext) || {};
  const { brands, selectedBrandId, setSelectedBrandId, selectedBrand, refetch, loading } = useBrandManagement();
  const [brandForm, setBrandForm] = useState({ name: "", slug: "", businessName: "", businessEmail: "", businessPhone: "" });
  const [branchName, setBranchName] = useState("");
  const [member, setMember] = useState({ userId: "", role: "manager" });
  const { data: memberData, refetch: refetchMembers } = useQuery(MEMBERS, { variables: { brandId: selectedBrandId }, skip: !selectedBrandId });
  const [createBrand] = useMutation(CREATE_BRAND, { refetchQueries: [MY_BRANDS_QUERY] });
  const [updateBrand] = useMutation(UPDATE_BRAND, { refetchQueries: [MY_BRANDS_QUERY] });
  const [createRestaurant] = useMutation(CREATE_RESTAURANT, { refetchQueries: [MY_BRANDS_QUERY] });
  const [addMember] = useMutation(ADD_MEMBER);
  const [updateMember] = useMutation(UPDATE_MEMBER);
  const saveBrand = async (event) => { event.preventDefault(); const input = Object.fromEntries(Object.entries(brandForm).filter(([,v]) => v)); selectedBrand ? await updateBrand({ variables: { id: selectedBrand.id, input } }) : await createBrand({ variables: { input } }); setBrandForm({ name: "", slug: "", businessName: "", businessEmail: "", businessPhone: "" }); refetch(); };
  const addBranch = async () => { if (!selectedBrandId || !branchName.trim()) return; await createRestaurant({ variables: { input: { name: branchName.trim(), brandId: selectedBrandId, managerId: user?.id || user?._id } } }); setBranchName(""); };
  const saveMember = async () => { if (!selectedBrandId || !member.userId) return; await addMember({ variables: { input: { brandId: selectedBrandId, userId: member.userId, role: member.role } } }); setMember({ userId: "", role: "manager" }); refetchMembers?.(); };

  return <div className="space-y-4">
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Quản lý chuỗi nhà hàng</h2>
      <p className="text-sm text-slate-500">Tạo Brand, xem chi nhánh và phân quyền thành viên theo chuỗi.</p>
      {loading && <p>Đang tải Brand...</p>}
      <div className="mt-4 flex flex-wrap gap-2">{brands.map((b) => <button key={b.id} className={`rounded-full px-4 py-2 ${b.id === selectedBrandId ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setSelectedBrandId(b.id)}>{b.name} ({b.restaurantCount})</button>)}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={saveBrand} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold">{selectedBrand ? "Sửa Brand" : "Tạo Brand"}</h3>
        {[["name","Tên chuỗi"],["slug","Slug"],["businessName","Tên pháp lý"],["businessEmail","Email doanh nghiệp"],["businessPhone","SĐT doanh nghiệp"]].map(([k,p]) => <input key={k} className="w-full rounded-xl border px-3 py-2" placeholder={selectedBrand?.[k] || p} value={brandForm[k]} onChange={(e)=>setBrandForm({...brandForm,[k]:e.target.value})} />)}
        <button className="rounded-xl bg-emerald-600 px-4 py-2 text-white">Lưu Brand</button>
      </form>
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold">Chi nhánh của {selectedBrand?.name || "Brand"}</h3>
        <ul className="list-disc pl-5">{(selectedBrand?.restaurants || []).map((r)=><li key={r.id}>{r.name}</li>)}</ul>
        <input className="w-full rounded-xl border px-3 py-2" placeholder="Tên chi nhánh mới" value={branchName} onChange={(e)=>setBranchName(e.target.value)} />
        <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-white" onClick={addBranch}>Thêm chi nhánh</button>
      </div>
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
      <h3 className="font-semibold">Thành viên Brand</h3>
      <p className="text-xs text-slate-500">Nhập User ID của tài khoản đã tồn tại. Repo hiện chưa có query tìm user theo email/phone phù hợp để tái dùng ở màn này.</p><div className="grid gap-2 md:grid-cols-3"><input className="rounded-xl border px-3 py-2" placeholder="User ID của thành viên" value={member.userId} onChange={(e)=>setMember({...member,userId:e.target.value})}/><select className="rounded-xl border px-3 py-2" value={member.role} onChange={(e)=>setMember({...member,role:e.target.value})}>{["owner","admin","manager","staff"].map((r)=><option key={r}>{r}</option>)}</select><button className="rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={saveMember}>Thêm thành viên</button></div>
      <div className="divide-y">{(memberData?.brandMembers || []).map((m)=><div key={m.id} className="flex items-center justify-between py-2"><span>{m.user?.fullName || m.user?.email || m.userId} — {m.role} ({m.status})</span><button onClick={()=>updateMember({ variables:{ input:{ id:m.id, status:m.status === "active" ? "inactive" : "active" }}}).then(()=>refetchMembers?.())} className="text-sm text-blue-700">Đổi trạng thái</button></div>)}</div>
    </section>
  </div>;
}
