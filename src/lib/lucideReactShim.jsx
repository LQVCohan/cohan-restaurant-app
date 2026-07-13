// Temporary build-safe lucide-react shim.
// The project aliases lucide-react here because this environment currently
// receives 403 responses from npm registry for the real package.
// When registry access is available, install lucide-react and remove the alias
// in vite.config.js; see docs/lucide-react-shim.md.
import React from "react";

const toKebab = (value = "icon") =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();

const createIcon = (displayName) => {
  const Icon = React.forwardRef(({ size = 24, color = "currentColor", strokeWidth = 2, className = "", style, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["lucide", `lucide-${toKebab(displayName)}`, className].filter(Boolean).join(" ")}
      style={style}
      aria-hidden={props["aria-label"] ? undefined : true}
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="12" r="9" opacity="0.2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  ));
  Icon.displayName = displayName;
  return Icon;
};

const iconNames = [
  "Accessibility", "Activity", "AlarmClock", "AlertCircle", "AlertOctagon", "AlertTriangle", "Archive", "ArrowDown", "ArrowDownLeft", "ArrowDownRight", "ArrowDownUp", "ArrowLeft", "ArrowRight", "ArrowRightLeft", "ArrowUp", "ArrowUpRight", "Award", "BadgeCheck", "BadgeDollarSign", "BadgePercent", "Ban", "Banknote", "BarChart", "BarChart2", "BarChart3", "Barcode", "Beef", "Bell", "BellOff", "BellRing", "Bike", "BookOpen", "Bookmark", "Bot", "Box", "Boxes", "Briefcase", "BriefcaseBusiness", "Building", "Building2", "Calculator", "Calendar", "CalendarCheck", "CalendarCheck2", "CalendarClock", "CalendarDays", "CalendarRange", "Camera", "CameraOff", "Carrot", "ChartNoAxesColumnIncreasing", "Check", "CheckCheck", "CheckCircle", "CheckCircle2", "ChefHat", "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronUp", "ChevronsLeft", "ChevronsRight", "ChevronsUpDown", "Circle", "CircleCheck", "CircleDollarSign", "CircleHelp", "CirclePause", "CirclePlay", "CirclePlus", "CircleSlash", "CircleX", "Clipboard", "ClipboardCheck", "ClipboardEdit", "ClipboardList", "Clock", "Clock3", "CloudUpload", "Coffee", "Coins", "Columns3", "Combine", "Compass", "CookingPot", "Copy", "CreditCard", "Crown", "CupSoda", "Database", "DollarSign", "Dot", "Download", "Droplet", "Droplets", "Edit", "Edit2", "Edit3", "Ellipsis", "EllipsisVertical", "Eraser", "ExternalLink", "Eye", "EyeOff", "Facebook", "File", "FileClock", "FileDown", "FileImage", "FilePlus2", "FileSpreadsheet", "FileText", "FileUp", "Filter", "FilterX", "Fish", "Flag", "Flame", "FolderPlus", "Gauge", "Gift", "Grid", "Grid2X2", "Grid3X3", "GripVertical", "Hand", "HandCoins", "HardDrive", "Hash", "Headphones", "Heart", "HelpCircle", "History", "Home", "IdCard", "Image", "ImageOff", "ImagePlus", "Inbox", "Info", "Instagram", "Key", "KeyRound", "Languages", "Layers", "Layers3", "Layout", "LayoutDashboard", "LayoutGrid", "LayoutList", "Leaf", "Link", "Link2Off", "List", "ListChecks", "ListFilter", "Loader", "Loader2", "LocateFixed", "Lock", "LockKeyhole", "LogOut", "Mail", "Map", "MapPin", "MapPinned", "Maximize2", "Medal", "Megaphone", "Menu", "MessageCircle", "MessageSquare", "MessageSquareHeart", "Minimize2", "Minus", "MinusCircle", "Monitor", "MonitorCog", "Moon", "MoreHorizontal", "MoreVertical", "MousePointer2", "Move", "MoveDown", "MoveLeft", "MoveRight", "MoveUp", "Navigation", "Package", "PackageMinus", "PackageOpen", "PackagePlus", "PackageSearch", "Palette", "Palmtree", "PanelLeftClose", "PanelLeftOpen", "Paperclip", "PartyPopper", "Pause", "PauseCircle", "Pencil", "Percent", "Phone", "PhoneCall", "PieChart", "Pin", "Pizza", "Play", "PlayCircle", "Plus", "PlusCircle", "Power", "PowerOff", "Printer", "QrCode", "Receipt", "ReceiptText", "RefreshCcw", "RefreshCw", "Repeat2", "RotateCcw", "RotateCw", "Route", "Save", "Scale", "ScanLine", "Scissors", "Search", "SearchX", "Send", "Server", "Settings", "Settings2", "Share2", "Shield", "ShieldAlert", "ShieldCheck", "ShoppingBag", "ShoppingCart", "SlidersHorizontal", "Smartphone", "Smile", "Soup", "Sparkle", "Sparkles", "SquarePen", "Star", "StickyNote", "Store", "Sun", "Sunrise", "SwitchCamera", "Table", "Table2", "TableProperties", "Tag", "Tags", "Target", "Ticket", "TicketPercent", "Timer", "Trash", "Trash2", "TrendingDown", "TrendingUp", "Truck", "Twitter", "Type", "Undo2", "Unlock", "Upload", "UploadCloud", "User", "UserCheck", "UserCircle", "UserCog", "UserMinus", "UserPlus", "UserPlus2", "UserRound", "UserRoundCheck", "UserRoundCog", "UserRoundX", "UserX", "Users", "Users2", "UsersRound", "Utensils", "UtensilsCrossed", "Video", "Wallet", "WalletCards", "Warehouse", "Wifi", "Wine", "X", "XCircle", "Zap", "ZoomIn", "ZoomOut",
];

const iconMap = Object.fromEntries(iconNames.map((name) => [name, createIcon(name)]));

export const {
  Accessibility, Activity, AlarmClock, AlertCircle, AlertOctagon, AlertTriangle, Archive, ArrowDown, ArrowDownLeft,
  ArrowDownRight, ArrowDownUp, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, ArrowUpRight, Award, BadgeCheck,
  BadgeDollarSign, BadgePercent, Ban, Banknote, BarChart, BarChart2, BarChart3, Barcode, Beef, Bell, BellOff, BellRing,
  Bike, BookOpen, Bookmark, Bot, Box, Boxes, Briefcase, BriefcaseBusiness, Building, Building2, Calculator, Calendar,
  CalendarCheck, CalendarCheck2, CalendarClock, CalendarDays, CalendarRange, Camera, CameraOff, Carrot,
  ChartNoAxesColumnIncreasing, Check, CheckCheck, CheckCircle, CheckCircle2, ChefHat, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, ChevronsUpDown, Circle, CircleCheck, CircleDollarSign,
  CircleHelp, CirclePause, CirclePlay, CirclePlus, CircleSlash, CircleX, Clipboard, ClipboardCheck, ClipboardEdit,
  ClipboardList, Clock, Clock3, CloudUpload, Coffee, Coins, Columns3, Combine, Compass, CookingPot, Copy, CreditCard,
  Crown, CupSoda, Database, DollarSign, Dot, Download, Droplet, Droplets, Edit, Edit2, Edit3, Ellipsis,
  EllipsisVertical, Eraser, ExternalLink, Eye, EyeOff, Facebook, File, FileClock, FileDown, FileImage, FilePlus2,
  FileSpreadsheet, FileText, FileUp, Filter, FilterX, Fish, Flag, Flame, FolderPlus, Gauge, Gift, Grid, Grid2X2,
  Grid3X3, GripVertical, Hand, HandCoins, HardDrive, Hash, Headphones, Heart, HelpCircle, History, Home,
  IdCard, Image, ImageOff, ImagePlus, Inbox, Info, Instagram, Key, KeyRound, Languages, Layers, Layers3, Layout,
  LayoutDashboard, LayoutGrid, LayoutList, Leaf, Link, Link2Off, List, ListChecks, ListFilter, Loader, Loader2, LocateFixed,
  Lock, LockKeyhole, LogOut, Mail, Map, MapPin, MapPinned, Maximize2, Medal, Megaphone, Menu, MessageCircle,
  MessageSquare, MessageSquareHeart, Minimize2, Minus, MinusCircle, Monitor, MonitorCog, Moon, MoreHorizontal, MoreVertical,
  MousePointer2, Move, MoveDown, MoveLeft, MoveRight, MoveUp, Navigation, Package, PackageMinus, PackageOpen,
  PackagePlus, PackageSearch, Palette, Palmtree, PanelLeftClose, PanelLeftOpen, Paperclip, PartyPopper, Pause,
  PauseCircle, Pencil, Percent, Phone, PhoneCall, PieChart, Pin, Pizza, Play, PlayCircle, Plus, PlusCircle, Power,
  PowerOff, Printer, QrCode, Receipt, ReceiptText, RefreshCcw, RefreshCw, Repeat2, RotateCcw, RotateCw, Route, Save,
  Scale, ScanLine, Scissors, Search, SearchX, Send, Server, Settings, Settings2, Share2, Shield, ShieldAlert,
  ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal, Smartphone, Smile, Soup, Sparkle, Sparkles, SquarePen,
  Star, StickyNote, Store, Sun, Sunrise, SwitchCamera, Table, Table2, TableProperties, Tag, Tags, Target, Ticket,
  TicketPercent, Timer, Trash, Trash2, TrendingDown, TrendingUp, Truck, Twitter, Type, Undo2, Unlock, Upload,
  UploadCloud, User, UserCheck, UserCircle, UserCog, UserMinus, UserPlus, UserPlus2, UserRound, UserRoundCheck,
  UserRoundCog, UserRoundX, UserX, Users, Users2, UsersRound, Utensils, UtensilsCrossed, Video, Wallet, WalletCards,
  Warehouse, Wifi, Wine, X, XCircle, Zap, ZoomIn, ZoomOut,
} = iconMap;

export default createIcon("LucideIcon");
