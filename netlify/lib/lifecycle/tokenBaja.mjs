// FINPATHIA · Token firmado para darse de baja de los correos de la prueba.
// token = base64url(accountId) + "." + base64url(HMAC-SHA256(secreto, "baja:" + accountId))
// El secreto sale de EMAIL_UNSUB_SECRET. Sin secreto no se firma ni se
// verifica nada (y el cron no envía en modo real).
import { createHmac, timingSafeEqual } from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function firmarTokenBaja(accountId, secreto) {
  if (!accountId || !secreto) return null;
  const mac = createHmac("sha256", secreto).update("baja:" + accountId).digest();
  return `${b64u(String(accountId))}.${b64u(mac)}`;
}

/** Devuelve el accountId si el token es válido; si no, null. */
export function verificarTokenBaja(token, secreto) {
  if (!token || !secreto || typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  let accountId;
  try { accountId = Buffer.from(partes[0], "base64url").toString("utf8"); } catch { return null; }
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return null;
  const esperado = createHmac("sha256", secreto).update("baja:" + accountId).digest();
  let recibido;
  try { recibido = Buffer.from(partes[1], "base64url"); } catch { return null; }
  if (recibido.length !== esperado.length) return null;
  return timingSafeEqual(recibido, esperado) ? accountId : null;
}
