import React from "react";
import { useForm } from "react-hook-form";
import { useTables } from "../../../../hooks/useTables";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import Input from "../../../common/Input";
import "./ReservationModal.scss";

const ReservationModal = ({ isOpen, onClose }) => {
  const { makeReservation } = useTables();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = (data) => {
    const success = makeReservation(data);
    if (success) {
      reset();
      onClose();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Set default time to 1 hour from now
  const getDefaultTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Đặt bàn" size="md">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Tên khách hàng:"
          {...register("customerName", {
            required: "Vui lòng nhập tên khách hàng",
          })}
          error={errors.customerName?.message}
          placeholder="Nhập tên khách hàng"
        />

        <Input
          label="Số điện thoại:"
          type="tel"
          {...register("customerPhone", {
            required: "Vui lòng nhập số điện thoại",
          })}
          error={errors.customerPhone?.message}
          placeholder="Nhập số điện thoại"
        />

        <Input
          label="Số khách:"
          type="number"
          {...register("guestCount", {
            required: "Vui lòng nhập số khách",
            min: { value: 1, message: "Số khách phải lớn hơn 0" },
          })}
          error={errors.guestCount?.message}
          placeholder="Số lượng khách"
          min="1"
        />

        <Input
          label="Thời gian đặt:"
          type="datetime-local"
          {...register("reservationTime", {
            required: "Vui lòng chọn thời gian",
          })}
          error={errors.reservationTime?.message}
          defaultValue={getDefaultTime()}
        />

        <div className="form-group">
          <label className="form-label">Ghi chú:</label>
          <textarea
            {...register("note")}
            className="input"
            rows="3"
            placeholder="Ghi chú đặc biệt..."
          />
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Xác nhận đặt bàn
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReservationModal;
