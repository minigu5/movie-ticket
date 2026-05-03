export type PaymentStatus = "pending" | "confirmed" | "group_pending";

export type PopcornFlavor = "original" | "consomme" | "caramel";

export const POPCORN_LABELS: Record<PopcornFlavor, string> = {
  original: "오리지널 버터 팝콘",
  consomme: "콘소메맛 팝콘",
  caramel: "카라멜맛 팝콘",
};

export const POPCORN_PRICE = 2500;

export interface Reservation {
  id: string;
  movie_date: string;
  student_id: string;
  student_name: string;
  password: string | null;
  seat_number: string;
  payment_status: PaymentStatus;
  popcorn_order: string;
  is_printed: boolean | null;
  is_group_leader: boolean | null;
  group_id: string | null;
  group_expires_at: string | null;
  group_report_sent: boolean | null;
  created_at: string;
}

export interface MovieSettings {
  id: number;
  title: string;
  date_string: string;
  db_date: string;
  venue: string;
  age_rating: string;
  poster_url: string;
  deadline_date: string;
  mid_vip_start_row: string;
  mid_vip_end_row: string;
  mid_vip_start_col: number;
  mid_vip_end_col: number;
  grand_vip_start_row: string;
  grand_vip_end_row: string;
  grand_vip_start_col: number;
  grand_vip_end_col: number;
}

export interface BlacklistEntry {
  id: number;
  student_id: string;
  student_name: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  student_id: string;
  student_name: string;
  description: string;
  created_at: string;
}

export interface VerifyPasswordResult {
  exists: boolean;
  success: boolean;
}

export interface SeatSummary {
  status: PaymentStatus;
  name: string;
  ticketId: string;
  popcorn?: string;
}
