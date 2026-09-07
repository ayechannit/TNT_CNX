import { PhoneIcon } from "./icons";
import "./PhoneCallLink.css";

/** Click-to-call phone number - opens whatever the OS/browser has registered for tel: links. */
export default function PhoneCallLink({ phone, className }) {
  if (!phone) return null;
  return (
    <a className={`phone-call-link ${className || ""}`} href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}>
      <PhoneIcon />
      {phone}
    </a>
  );
}
