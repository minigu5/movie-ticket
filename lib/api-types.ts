import type { MovieSettings } from "./db-types";

export type TicketStatusType = "confirmed" | "pending" | "changed" | "canceled";

export interface TicketRequest {
  email: string;
  name: string;
  seat: string;
  movieTitle: string;
  movieDate: string;
  statusType: TicketStatusType;
  popcorn?: string;
  ticketId: string;
  baseUrl: string;
  isRefundNeeded?: boolean;
}

export interface RequestResetBody {
  studentId: string;
  studentName: string;
  baseUrl: string;
  returnUrl?: string;
}

export interface BlacklistMailBody {
  email: string;
  name: string;
  action: "added" | "removed";
}

export interface PromoRecipient {
  studentId: string;
  email: string;
  name: string;
}

export interface PromoBody {
  chunk: PromoRecipient[];
  movieInfo: MovieSettings;
  baseUrl: string;
}

export interface GroupInviteMember {
  email: string;
  name: string;
  seat: string;
  studentId: string;
  memberId: string;
}

export interface GroupInviteBody {
  members: GroupInviteMember[];
  leaderName: string;
  movieTitle: string;
  movieDate: string;
  groupId: string;
  baseUrl: string;
}

export type AdminAction =
  | { action: "LOGIN"; adminPassword: string }
  | { action: "FETCH_INITIAL_DATA"; adminPassword: string }
  | { action: "UPDATE_SETTINGS"; adminPassword: string; payload: Partial<MovieSettings> }
  | { action: "CLEAR_RESERVATIONS"; adminPassword: string; payload: { movieDate: string } }
  | {
      action: "APPROVE_RESERVATION";
      adminPassword: string;
      payload: { id: string; studentId: string; studentName: string; seatNumber: string };
    }
  | {
      action: "CANCEL_RESERVATION";
      adminPassword: string;
      payload: {
        id: string;
        studentId: string;
        studentName: string;
        seatNumber: string;
        description?: string;
      };
    }
  | {
      action: "RESET_PRINT";
      adminPassword: string;
      payload: { id: string; studentId: string; studentName: string; seatNumber: string };
    }
  | {
      action: "ADD_BLACKLIST";
      adminPassword: string;
      payload: { studentId: string; studentName: string; movieDate: string };
    }
  | {
      action: "REMOVE_BLACKLIST";
      adminPassword: string;
      payload: { studentId: string };
    }
  | {
      action: "LOG_ACTION";
      adminPassword: string;
      payload: { studentId: string; studentName: string; description: string };
    };

export type KioskAction =
  | {
      action: "PRINT_TICKET";
      payload: {
        ticketId: string;
        studentId: string;
        studentName: string;
        password: string;
        seatNumber: string;
      };
    }
  | {
      action: "UPDATE_GROUP_POPCORN";
      payload: {
        reservationId: string;
        popcornOrder: string | null;
        paymentStatus: "pending" | "confirmed";
      };
    };

export interface ApiOk<T = undefined> {
  success: true;
  data?: T;
  canceledTicket?: unknown;
}

export interface ApiError {
  success: false;
  error: string;
}
