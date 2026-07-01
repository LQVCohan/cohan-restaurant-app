import React, { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import useBrandManagement, { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";
import { getBrandRoleLabel, getMembershipScopeLabel } from "@/lib/userRoleDisplay";

const UPDATE_BRAND = gql`mutation UpdateBrand($id: ID!, $input: UpdateBrandInput!) { updateBrand(id: $id, input: $input) { id name slug businessName businessEmail businessPhone status } }`;
const CREATE_RESTAURANT = gql`mutation CreateRestaurant($input: CreateRestaurantInput!) { createRestaurant(input: $input) { id name brandId } }`;
const MEMBERS = gql`query BrandMembers($brandId: ID!) { brandMembers(brandId: $brandId) { id role status user { id fullName email } restaurantIds } }`;
const ADD_MEMBER = gql`mutation AddBrandMember($input: AddBrandMemberInput!) { addBrandMember(input: $input) { id } }`;
const UPDATE_MEMBER = gql`mutation UpdateBrandMember($input: UpdateBrandMemberInput!) { updateBrandMember(input: $input) { id role status } }`;

const getAssignedManagerByRestaurant = (members = []) => new Map(
  members
    .filter((m) => m.role === "manager" && m.status === "active" && m.restaurantIds?.[0])
    .map((m) => [String(m.restaurantIds[0]), m]),
);

const emptyBrandForm = { name: "", slug: "", businessName: "", businessEmail: "", businessPhone: "" };

export default function BrandManagement() {
  const { brands, selectedBrandId, setSelectedBrandId, selectedBrand, setSelectedRestaurantId, refetch, loading } = useBrandManagement();
  const [brandForm, setBrandForm] = useState(emptyBrandForm);
  const [branchName, setBranchName] = useState("");
  const [member, setMember] = useState({ userId: "", role: "manager", restaurantIds: [] });
  const { data: memberData, refetch: refetchMembers } = useQuery(MEMBERS, { variables: { brandId: selectedBrandId }, skip: !selectedBrandId });
  const [updateBrand] = useMutation(UPDATE_BRAND, { refetchQueries: [MY_BRANDS_QUERY] });
  const [createRestaurant] = useMutation(CREATE_RESTAURANT, { refetchQueries: [MY_BRANDS_QUERY] });
  const [addMember] = useMutation(ADD_MEMBER);
  const [updateMember] = useMutation(UPDATE_MEMBER);

  useEffect(() => {
    if (!selectedBrand) {
      setBrandForm(emptyBrandForm);
      return;
    }
    setBrandForm({
      name: selectedBrand.name || "",
      slug: selectedBrand.slug || "",
      businessName: selectedBrand.businessName || "",
      businessEmail: selectedBrand.businessEmail || "",
      businessPhone: selectedBrand.businessPhone || "",
    });
  }, [selectedBrand]);

  const saveBrand = async (event) => {
    event.preventDefault();
    if (!selectedBrand) return;
    const input = Object.fromEntries(Object.entries(brandForm).filter(([, value]) => String(value || "").trim()));
    await updateBrand({ variables: { id: selectedBrand.id, input } });
    refetch();
  };
  const addBranch = async () => { if (!selectedBrandId || !branchName.trim()) return; const result = await createRestaurant({ variables: { input: { name: branchName.trim(), brandId: selectedBrandId } } }); const newRestaurantId = result?.data?.createRestaurant?.id; if (newRestaurantId) setSelectedRestaurantId(newRestaurantId); setBranchName(""); refetch(); };
  const saveMember = async () => { if (!selectedBrandId || !member.userId || (member.role === "manager" && member.restaurantIds.length !== 1) || (member.role === "staff" && !member.restaurantIds.length)) return; const input = { brandId: selectedBrandId, userId: member.userId, role: member.role, restaurantIds: member.role === "admin" ? [] : member.restaurantIds }; await addMember({ variables: { input } }); setMember({ userId: "", role: "manager", restaurantIds: [] }); refetchMembers?.(); };
  const toggleMemberRestaurant = (id) => setMember((prev) => ({ ...prev, restaurantIds: prev.restaurantIds.includes(id) ? prev.restaurantIds.filter((item) => item !== id) : [...prev.restaurantIds, id] }));
  const members = memberData?.brandMembers || [];
  const assignedManagerByRestaurant = getAssignedManagerByRestaurant(members);
  const branchScopedMember = ["manager", "staff"].includes(member.role);

  return <div className="space-y-4">
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Quản lý chuỗi nhà hàng</h2>
      <p className="text-sm text-slate-500">Xem Brand hiện có, cấu hình thông tin, chi nhánh và phân quyền thành viên theo chuỗi.</p>
      {loading && <p>Đang tải Brand...</p>}
      {!loading && !brands.length && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Chưa có thương hiệu. Brand mới cần được tạo từ màn Đăng ký → Thương hiệu.</p>}
      <div className="mt-4 flex flex-wrap gap-2">{brands.map((b) => <button key={b.id} className={`rounded-full px-4 py-2 ${b.id === selectedBrandId ? "bg-slate-900 text-white" : "bg-slate-100"}`} onClick={() => setSelectedBrandId(b.id)}>{b.name} ({b.restaurantCount})</button>)}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={saveBrand} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold">Cấu hình Brand</h3>
        {!selectedBrand && <p className="text-sm text-slate-500">Chọn một Brand để cập nhật thông tin.</p>}
        {[ ["name","Tên chuỗi"], ["slug","Slug"], ["businessName","Tên pháp lý"], ["businessEmail","Email doanh nghiệp"], ["businessPhone","SĐT doanh nghiệp"] ].map(([key, placeholder]) => <input key={key} disabled={!selectedBrand} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400" placeholder={placeholder} value={brandForm[key]} onChange={(e)=>setBrandForm({...brandForm,[key]:e.target.value})} />)}
        <button disabled={!selectedBrand} className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">Lưu cấu hình Brand</button>
      </form>
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold">Chi nhánh của {selectedBrand?.name || "Brand"}</h3>
        <ul className="list-disc pl-5">{(selectedBrand?.restaurants || []).map((r)=><li key={r.id}>{r.name}</li>)}</ul>
        <input disabled={!selectedBrandId} className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Tên chi nhánh mới" value={branchName} onChange={(e)=>setBranchName(e.target.value)} />
        <button type="button" disabled={!selectedBrandId} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50" onClick={addBranch}>Thêm chi nhánh</button>
      </div>
    </section>
    <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
      <h3 className="font-semibold">Thành viên Brand</h3>
      <p className="text-xs text-slate-500">Nhập User ID của tài khoản đã tồn tại. Repo hiện chưa có query tìm user theo email/phone phù hợp để tái dùng ở màn này.</p><div className="grid gap-2 md:grid-cols-3"><input className="rounded-xl border px-3 py-2" placeholder="User ID của thành viên" value={member.userId} onChange={(e)=>setMember({...member,userId:e.target.value})}/><select className="rounded-xl border px-3 py-2" value={member.role} onChange={(e)=>setMember({...member,role:e.target.value,restaurantIds:[]})}>{["admin","manager","staff"].map((r)=><option key={r} value={r}>{getBrandRoleLabel({ membership: { role: r } })}</option>)}</select><button className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={!selectedBrandId || (member.role === "manager" && member.restaurantIds.length !== 1) || (member.role === "staff" && !member.restaurantIds.length)} onClick={saveMember}>Thêm thành viên</button></div>{member.role === "admin" && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Admin Brand có quyền trên toàn bộ Brand.</p>}{member.role === "manager" && <label className="block text-sm font-medium text-slate-700">Nhà hàng phụ trách<select className="mt-1 w-full rounded-xl border px-3 py-2" value={member.restaurantIds[0] || ""} onChange={(e)=>setMember({...member,restaurantIds:e.target.value ? [e.target.value] : []})}><option value="">Chọn 1 nhà hàng</option>{(selectedBrand?.restaurants || []).map((r)=>{ const assigned = assignedManagerByRestaurant.get(String(r.id)); return <option key={r.id} value={r.id} disabled={Boolean(assigned)}>{r.name}{assigned ? " — đã có quản lý" : ""}</option>; })}</select></label>}{member.role === "staff" && <div className="flex flex-wrap gap-2">{(selectedBrand?.restaurants || []).map((r)=><label key={r.id} className="rounded-full border px-3 py-1 text-sm"><input type="checkbox" className="mr-2" checked={member.restaurantIds.includes(r.id)} onChange={()=>toggleMemberRestaurant(r.id)} />{r.name}</label>)}</div>}
      <div className="divide-y">{members.map((m)=><div key={m.id} className="flex items-center justify-between gap-3 py-2"><span><strong>{m.user?.fullName || m.user?.email || m.userId}</strong><span className="text-slate-500"> — {m.user?.email}</span><br/><span className="text-sm text-slate-600">Vai trò trong Brand: {getBrandRoleLabel({ membership: m })} · Phạm vi phụ trách: {getMembershipScopeLabel(m, selectedBrand?.restaurants, selectedBrand?.name)} · {m.status}</span></span><button onClick={()=>updateMember({ variables:{ input:{ id:m.id, status:m.status === "active" ? "inactive" : "active" }}}).then(()=>refetchMembers?.())} className="text-sm text-blue-700">Đổi trạng thái</button></div>)}</div>
    </section>
  </div>;
}
