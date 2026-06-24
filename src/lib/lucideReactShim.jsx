import React from "react";

const toKebab = (value = "icon") =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();

const createIcon = (name) => {
  const Icon = ({ size = 24, color = "currentColor", strokeWidth = 2, className = "", ...props }) => (
    <svg
      aria-hidden="true"
      className={["lucide", `lucide-${toKebab(name)}`, className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
  Icon.displayName = name;
  return Icon;
};

export const Activity = createIcon("Activity");
export const AlertCircle = createIcon("AlertCircle");
export const AlertTriangle = createIcon("AlertTriangle");
export const Archive = createIcon("Archive");
export const ArrowDown = createIcon("ArrowDown");
export const ArrowLeft = createIcon("ArrowLeft");
export const ArrowRight = createIcon("ArrowRight");
export const ArrowUp = createIcon("ArrowUp");
export const Ban = createIcon("Ban");
export const BarChart3 = createIcon("BarChart3");
export const Beef = createIcon("Beef");
export const Bell = createIcon("Bell");
export const Bot = createIcon("Bot");
export const Building2 = createIcon("Building2");
export const Calendar = createIcon("Calendar");
export const CalendarCheck = createIcon("CalendarCheck");
export const CalendarCheck2 = createIcon("CalendarCheck2");
export const CalendarClock = createIcon("CalendarClock");
export const CalendarDays = createIcon("CalendarDays");
export const Camera = createIcon("Camera");
export const Check = createIcon("Check");
export const CheckCheck = createIcon("CheckCheck");
export const CheckCircle = createIcon("CheckCircle");
export const CheckCircle2 = createIcon("CheckCircle2");
export const ChefHat = createIcon("ChefHat");
export const ChevronDown = createIcon("ChevronDown");
export const ChevronLeft = createIcon("ChevronLeft");
export const ChevronRight = createIcon("ChevronRight");
export const ChevronUp = createIcon("ChevronUp");
export const Circle = createIcon("Circle");
export const ClipboardList = createIcon("ClipboardList");
export const Clock = createIcon("Clock");
export const Clock3 = createIcon("Clock3");
export const Coffee = createIcon("Coffee");
export const Copy = createIcon("Copy");
export const CreditCard = createIcon("CreditCard");
export const DollarSign = createIcon("DollarSign");
export const Dot = createIcon("Dot");
export const Download = createIcon("Download");
export const Edit = createIcon("Edit");
export const Edit2 = createIcon("Edit2");
export const Edit3 = createIcon("Edit3");
export const ExternalLink = createIcon("ExternalLink");
export const Eye = createIcon("Eye");
export const EyeOff = createIcon("EyeOff");
export const FileText = createIcon("FileText");
export const Filter = createIcon("Filter");
export const Fish = createIcon("Fish");
export const Gift = createIcon("Gift");
export const Grid3X3 = createIcon("Grid3X3");
export const GripVertical = createIcon("GripVertical");
export const Heart = createIcon("Heart");
export const Home = createIcon("Home");
export const Image = createIcon("Image");
export const Info = createIcon("Info");
export const KeyRound = createIcon("KeyRound");
export const Layers = createIcon("Layers");
export const LayoutGrid = createIcon("LayoutGrid");
export const Link = createIcon("Link");
export const Loader2 = createIcon("Loader2");
export const Lock = createIcon("Lock");
export const LockKeyhole = createIcon("LockKeyhole");
export const Mail = createIcon("Mail");
export const Map = createIcon("Map");
export const MapPin = createIcon("MapPin");
export const Maximize2 = createIcon("Maximize2");
export const Menu = createIcon("Menu");
export const MessageCircle = createIcon("MessageCircle");
export const Minimize2 = createIcon("Minimize2");
export const Minus = createIcon("Minus");
export const Moon = createIcon("Moon");
export const MoreHorizontal = createIcon("MoreHorizontal");
export const MoreVertical = createIcon("MoreVertical");
export const Move = createIcon("Move");
export const Navigation = createIcon("Navigation");
export const Package = createIcon("Package");
export const Paperclip = createIcon("Paperclip");
export const Pause = createIcon("Pause");
export const Phone = createIcon("Phone");
export const Pin = createIcon("Pin");
export const Pizza = createIcon("Pizza");
export const Play = createIcon("Play");
export const Plus = createIcon("Plus");
export const Printer = createIcon("Printer");
export const QrCode = createIcon("QrCode");
export const RefreshCw = createIcon("RefreshCw");
export const RotateCw = createIcon("RotateCw");
export const Save = createIcon("Save");
export const Search = createIcon("Search");
export const Send = createIcon("Send");
export const Settings = createIcon("Settings");
export const Shield = createIcon("Shield");
export const ShoppingCart = createIcon("ShoppingCart");
export const Soup = createIcon("Soup");
export const Sparkles = createIcon("Sparkles");
export const Star = createIcon("Star");
export const Store = createIcon("Store");
export const Sun = createIcon("Sun");
export const Sunrise = createIcon("Sunrise");
export const Table2 = createIcon("Table2");
export const Ticket = createIcon("Ticket");
export const Trash = createIcon("Trash");
export const Trash2 = createIcon("Trash2");
export const TrendingDown = createIcon("TrendingDown");
export const TrendingUp = createIcon("TrendingUp");
export const Truck = createIcon("Truck");
export const Unlock = createIcon("Unlock");
export const Upload = createIcon("Upload");
export const User = createIcon("User");
export const UserCheck = createIcon("UserCheck");
export const UserPlus = createIcon("UserPlus");
export const UserX = createIcon("UserX");
export const Users = createIcon("Users");
export const Utensils = createIcon("Utensils");
export const Video = createIcon("Video");
export const Wallet = createIcon("Wallet");
export const Wine = createIcon("Wine");
export const X = createIcon("X");
export const XCircle = createIcon("XCircle");
export const ZoomIn = createIcon("ZoomIn");
export const ZoomOut = createIcon("ZoomOut");

export default createIcon("LucideIcon");
