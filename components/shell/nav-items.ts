import {
  Bell,
  Bookmark,
  BookOpen,
  Compass,
  FileText,
  Globe,
  GraduationCap,
  Hash,
  Home,
  Mail,
  PenLine,
  Scale,
  UserCircle,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const mainNav: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/barks", label: "Reactions", icon: FileText },
  { href: "/cases", label: "Accountability Cases", icon: Scale },
  { href: "/stories", label: "Stories", icon: BookOpen },
  { href: "/learn", label: "Learning Center", icon: GraduationCap },
  { href: "/topics", label: "Topics", icon: Hash },
  { href: "/countries", label: "Countries", icon: Globe },
  { href: "/creators", label: "Creators", icon: Users },
];

export const personalNav: NavItem[] = [
  { href: "/following", label: "Following", icon: UserPlus },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/circles", label: "Research Circles", icon: Users },
  { href: "/stories/apply", label: "Become a Writer", icon: PenLine },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserCircle },
];
