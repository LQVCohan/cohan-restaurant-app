import React from "react";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import { usePOS } from "../../../../context/PosContext";
import { Printer, X } from "lucide-react";
import toast from "react-hot-toast";
import "./PrintQueueModal.scss";

export default function PrintQueueModal({ isOpen, open, onClose }) {
  const visible = isOpen ?? open;
  const { state, dispatch } = usePOS();
  const queue = state.printQueue || [];

  const handlePrintItem = (job) => {
    // simulate print
    dispatch({ type: "PRINT_JOB", payload: { id: job.id } });
    toast.success(`Đã gửi lệnh in: ${job.title || job.id}`);
  };

  const handleClear = () => {
    dispatch({ type: "CLEAR_PRINT_QUEUE" });
    toast.success("Đã xóa hàng đợi in");
  };

  if (!visible) return null;
  return (
    <Modal isOpen={visible} onClose={onClose} title="Hàng đợi in" size="md">
      <div className="print-queue-modal">
        {!queue.length ? (
          <div className="empty">
            <Printer size={48} />
            <h3>Không có lệnh in</h3>
            <p>Hiện tại không có lệnh in trong hàng đợi.</p>
          </div>
        ) : (
          <div className="queue-list">
            {queue.map((job) => (
              <div key={job.id} className="queue-item">
                <div className="job-info">
                  <div className="job-title">
                    {job.title || `In ${job.type}`}
                  </div>
                  <div className="job-meta">
                    {job.createdAt
                      ? new Date(job.createdAt).toLocaleString()
                      : ""}
                  </div>
                </div>
                <div className="job-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePrintItem(job)}
                  >
                    <Printer size={14} /> In
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      dispatch({
                        type: "REMOVE_PRINT_JOB",
                        payload: { id: job.id },
                      })
                    }
                  >
                    <X size={14} /> Xóa
                  </Button>
                </div>
              </div>
            ))}
            <div className="queue-footer">
              <div className="queue-count">Tổng lệnh: {queue.length}</div>
              <div className="queue-actions">
                <Button variant="secondary" onClick={onClose}>
                  Đóng
                </Button>
                <Button variant="danger" onClick={handleClear}>
                  Xóa tất cả
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
