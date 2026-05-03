import { STAFF_LIST, STUDENT_LIST } from "./constants";

export const STAFF_KEY = "교직원";

export interface ValidatedIdentity {
  ok: true;
  cleanId: string;
  authKey: string;
  isStaff: boolean;
}

export interface InvalidIdentity {
  ok: false;
  reason: string;
}

export function cleanStudentId(raw: string): string {
  return raw.replace(/['"]/g, "").trim();
}

export function validateIdentity(rawId: string, name: string): ValidatedIdentity | InvalidIdentity {
  const cleanId = cleanStudentId(rawId);
  if (cleanId === STAFF_KEY) {
    if (!STAFF_LIST.includes(name)) {
      return { ok: false, reason: "등록된 교직원 이름이 아닙니다." };
    }
    return { ok: true, cleanId, authKey: name, isStaff: true };
  }
  if (cleanId.length !== 4) {
    return { ok: false, reason: "학번은 4자리 숫자로 입력해주세요." };
  }
  if (STUDENT_LIST[cleanId] !== name) {
    return { ok: false, reason: "학번과 이름이 일치하지 않습니다." };
  }
  return { ok: true, cleanId, authKey: cleanId, isStaff: false };
}

export function validatePin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}
