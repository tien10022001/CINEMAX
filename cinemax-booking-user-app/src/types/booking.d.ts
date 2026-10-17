/**
 * CINEMAX REAL-TIME BOOKING & WEBSOCKET TYPESCRIPT DEFINITIONS
 */

export interface SeatHoldRequest {
  showtimeId: string;
  seatIds: string[];
  userId?: string;
  sessionId: string;
}

export interface SeatHoldResponse {
  success: boolean;
  message?: string;
  error?: string;
  heldSeats?: string[];
  heldUntil?: number;
  remainingSeconds?: number;
  conflicts?: Array<{ seat_id: string; reason: string }>;
}

export interface WebSocketEvent<T = any> {
  event: 'CONNECTED' | 'SHOWTIME_STATE' | 'SEATS_HELD' | 'SEATS_RELEASED' | 'SEATS_EXPIRED' | 'SEATS_SOLD' | 'HOLD_SUCCESS' | 'HOLD_FAILED';
  showtimeId?: string;
  data?: T;
}
