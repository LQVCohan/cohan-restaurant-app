export const validateBookingForm = (formData) => {
  const errors = {};

  if (!formData.customerName.trim()) {
    errors.customerName = "Vui lòng nhập họ và tên";
  }

  if (!formData.customerPhone.trim()) {
    errors.customerPhone = "Vui lòng nhập số điện thoại";
  } else if (!/^[0-9]{10,11}$/.test(formData.customerPhone)) {
    errors.customerPhone = "Số điện thoại không hợp lệ";
  }

  if (!formData.date) {
    errors.date = "Vui lòng chọn ngày";
  }

  if (!formData.time) {
    errors.time = "Vui lòng chọn giờ";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
