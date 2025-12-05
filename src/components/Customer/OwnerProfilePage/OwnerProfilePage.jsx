import { useParams } from "react-router-dom";

export default function OwnerProfilePage() {
  const { id } = useParams();

  return (
    <div className="owner-page">
      <h1>Thông tin chủ/ quản lý</h1>
      <div>ID: {id}</div>
    </div>
  );
}
