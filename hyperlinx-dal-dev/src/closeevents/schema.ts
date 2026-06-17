import type { CloseEvent as DALCloseEvent, CloseEventType } from "../types/dal";

export type { CloseEventType };

export interface CloseEvent extends DALCloseEvent {}
