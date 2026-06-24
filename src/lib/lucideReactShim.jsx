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

const iconNames = [
  "Accessibility", "Activity", "AlarmClock", "AlertCircle", "AlertOctagon", "AlertTriangle", "Archive", "ArrowDown", "ArrowDownRight", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowUpRight", "BadgeCheck", "Ban", "Banknote", "BarChart", "BarChart2", "BarChart3", "Beef", "Bell", "BellOff", "BookOpen", "Bot", "Box", "Boxes", "Briefcase", "Building", "Building2", "Calculator", "Calendar", "CalendarCheck", "CalendarCheck2", "CalendarClock", "CalendarDays", "CalendarRange", "Camera", "Carrot", "ChartNoAxesColumnIncreasing", "Check", "CheckCheck", "CheckCircle", "CheckCircle2", "ChefHat", "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronUp", "ChevronsUpDown", "Circle", "CircleCheck", "CircleDollarSign", "CircleHelp", "CirclePause", "CirclePlay", "CirclePlus", "Clipboard", "ClipboardCheck", "ClipboardList", "Clock", "Clock3", "CloudUpload", "Coffee", "Coins", "Columns3", "Copy", "CreditCard", "Crown", "Database", "DollarSign", "Dot", "Download", "Edit", "Edit2", "Edit3", "Ellipsis", "EllipsisVertical", "ExternalLink", "Eye", "EyeOff", "File", "FileDown", "FileImage", "FilePlus2", "FileSpreadsheet", "FileText", "FileUp", "Filter", "FilterX", "Fish", "Flag", "Gauge", "Gift", "Grid", "Grid2X2", "Grid3X3", "GripVertical", "Hash", "Headphones", "Heart", "HelpCircle", "Home", "Image", "ImagePlus", "Inbox", "Info", "Key", "KeyRound", "Languages", "Layers", "LayoutGrid", "Link", "List", "ListFilter", "Loader", "Loader2", "Lock", "LockKeyhole", "LogOut", "Mail", "Map", "MapPin", "MapPinned", "Maximize2", "Megaphone", "Menu", "MessageCircle", "MessageSquare", "Minimize2", "Minus", "Monitor", "Moon", "MoreHorizontal", "MoreVertical", "Move", "MoveDown", "MoveLeft", "MoveRight", "MoveUp", "Navigation", "Package", "PackageOpen", "PackageSearch", "PanelLeftClose", "PanelLeftOpen", "Paperclip", "Pause", "PauseCircle", "Percent", "Phone", "PieChart", "Pin", "Pizza", "Play", "PlayCircle", "Plus", "Printer", "QrCode", "Receipt", "RefreshCcw", "RefreshCw", "RotateCcw", "RotateCw", "Save", "ScanLine", "Search", "SearchX", "Send", "Settings", "Shield", "ShieldAlert", "ShieldCheck", "ShoppingBag", "ShoppingCart", "SlidersHorizontal", "Smartphone", "Soup", "Sparkle", "Sparkles", "SquarePen", "Star", "Store", "Sun", "Sunrise", "Table", "Table2", "Tag", "Tags", "Ticket", "Timer", "Trash", "Trash2", "TrendingDown", "TrendingUp", "Truck", "Undo2", "Unlock", "Upload", "User", "UserCheck", "UserCog", "UserMinus", "UserPlus", "UserRound", "UserX", "Users", "Utensils", "Video", "Wallet", "Warehouse", "Wifi", "Wine", "X", "XCircle", "Zap", "ZoomIn", "ZoomOut",
];

const iconMap = Object.fromEntries(iconNames.map((name) => [name, createIcon(name)]));

export const {
  Accessibility, Activity, AlarmClock, AlertCircle, AlertOctagon, AlertTriangle, Archive, ArrowDown, ArrowDownRight,
  ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BadgeCheck, Ban, Banknote, BarChart, BarChart2, BarChart3,
  Beef, Bell, BellOff, BookOpen, Bot, Box, Boxes, Briefcase, Building, Building2, Calculator, Calendar,
  CalendarCheck, CalendarCheck2, CalendarClock, CalendarDays, CalendarRange, Camera, Carrot,
  ChartNoAxesColumnIncreasing, Check, CheckCheck, CheckCircle, CheckCircle2, ChefHat, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, ChevronsUpDown, Circle, CircleCheck, CircleDollarSign, CircleHelp, CirclePause,
  CirclePlay, CirclePlus, Clipboard, ClipboardCheck, ClipboardList, Clock, Clock3, CloudUpload, Coffee, Coins,
  Columns3, Copy, CreditCard, Crown, Database, DollarSign, Dot, Download, Edit, Edit2, Edit3, Ellipsis,
  EllipsisVertical, ExternalLink, Eye, EyeOff, File, FileDown, FileImage, FilePlus2, FileSpreadsheet, FileText,
  FileUp, Filter, FilterX, Fish, Flag, Gauge, Gift, Grid, Grid2X2, Grid3X3, GripVertical, Hash, Headphones,
  Heart, HelpCircle, Home, Image, ImagePlus, Inbox, Info, Key, KeyRound, Languages, Layers, LayoutGrid, Link,
  List, ListFilter, Loader, Loader2, Lock, LockKeyhole, LogOut, Mail, Map, MapPin, MapPinned, Maximize2,
  Megaphone, Menu, MessageCircle, MessageSquare, Minimize2, Minus, Monitor, Moon, MoreHorizontal, MoreVertical,
  Move, MoveDown, MoveLeft, MoveRight, MoveUp, Navigation, Package, PackageOpen, PackageSearch, PanelLeftClose,
  PanelLeftOpen, Paperclip, Pause, PauseCircle, Percent, Phone, PieChart, Pin, Pizza, Play, PlayCircle, Plus,
  Printer, QrCode, Receipt, RefreshCcw, RefreshCw, RotateCcw, RotateCw, Save, ScanLine, Search, SearchX, Send,
  Settings, Shield, ShieldAlert, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal, Smartphone, Soup,
  Sparkle, Sparkles, SquarePen, Star, Store, Sun, Sunrise, Table, Table2, Tag, Tags, Ticket, Timer, Trash,
  Trash2, TrendingDown, TrendingUp, Truck, Undo2, Unlock, Upload, User, UserCheck, UserCog, UserMinus, UserPlus,
  UserRound, UserX, Users, Utensils, Video, Wallet, Warehouse, Wifi, Wine, X, XCircle, Zap, ZoomIn, ZoomOut,
} = iconMap;

export default createIcon("LucideIcon");
