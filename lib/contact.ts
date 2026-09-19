export type ContactFields = {
  name: string;
  contact: string;
  message: string;
};

export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export function validateContact(fields: ContactFields): ContactErrors {
  const errors: ContactErrors = {};

  if (!fields.name.trim()) errors.name = "Vui lòng nhập họ và tên.";
  if (!fields.contact.trim()) errors.contact = "Vui lòng nhập email hoặc số điện thoại.";
  if (!fields.message.trim()) errors.message = "Vui lòng nhập lời nhắn.";

  return errors;
}
