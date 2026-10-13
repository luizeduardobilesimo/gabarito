// Configuração do servidor (funções da Vercel). Só valores PÚBLICOS têm padrão no código;
// segredos vêm SEMPRE de variáveis de ambiente (ver docs/DEPLOY.md).

/** projeto Supabase da Rixel (identidade) — URL e chave publicável são públicas */
export const RIXEL_URL_PADRAO = 'https://dolwuqozocfyrutcdbsa.supabase.co';
export const RIXEL_CHAVE_PUBLICA_PADRAO = 'sb_publishable_ZtZN3PBpHbTNQhcuU7pkzg_4Wn1AUoH';
/** projeto Supabase do Gabarito (dados) — a chave secreta NUNCA fica aqui */
export const GABARITO_URL_PADRAO = 'https://cjeyxafuajbvuxrbufkq.supabase.co';
export const APP_URL_PADRAO = 'https://gabarito.rixel.com.br';
/** página de lançamento da Rixel — ENDEREÇO AINDA NÃO CONFIRMADO (código Next.js da Rixel); troque por RIXEL_LAUNCH_URL */
export const LAUNCH_URL_PADRAO = 'https://rixel.com.br/ferramentas/{tool}/abrir?challenge={challenge}&state={state}';

const sim = v => /^(1|true|sim|yes)$/i.test(String(v || '').trim());
const semBarra = u => String(u || '').replace(/\/+$/, '');

/** lê o ambiente (process.env por padrão) e devolve a configuração normalizada */
export function config(env = process.env) {
  const rixelUrl = semBarra(env.RIXEL_SUPABASE_URL || RIXEL_URL_PADRAO);
  const appUrl = semBarra(env.APP_URL || APP_URL_PADRAO);
  return {
    rixel: {
      url: rixelUrl,
      chavePublica: env.RIXEL_SUPABASE_PUBLISHABLE_KEY || RIXEL_CHAVE_PUBLICA_PADRAO,
      emissor: rixelUrl + '/auth/v1',
      jwks: rixelUrl + '/auth/v1/.well-known/jwks.json',
      aud: 'authenticated',
    },
    banco: {
      url: semBarra(env.GABARITO_SUPABASE_URL || GABARITO_URL_PADRAO),
      chave: env.GABARITO_SUPABASE_SECRET_KEY || '',
    },
    toolId: (env.GABARITO_TOOL_ID || '').trim(),
    // caminho A (principal): lançamento pela Rixel — protocolo de ferramentas (PKCE + sessão de produto)
    lancamento: {
      audience: env.GABARITO_AUDIENCE || 'gabarito',
      launchUrl: env.RIXEL_LAUNCH_URL || LAUNCH_URL_PADRAO,
      callback: appUrl + '/api/rixel/callback',   // cadastrado na Rixel EXATAMENTE assim (sem query string)
      destino: appUrl + '/',
    },
    sessao: {
      dias: Number(env.GABARITO_SESSAO_DIAS || 30),
      verificaSeg: Number(env.GABARITO_VERIFICA_SEG || 60),   // reconfere o direito na Rixel a cada 60 s
    },
    // caminho B (opcional): login direto por e-mail e senha no Auth da Rixel — DESLIGADO por padrão
    loginDireto: sim(env.GABARITO_LOGIN_DIRETO),
    // SÓ desenvolvimento/preview, e só no caminho B: libera qualquer usuário autenticado sem perguntar à Rixel
    acessoAberto: sim(env.GABARITO_ACESSO_ABERTO),
    acessoCacheSeg: Number(env.GABARITO_ACESSO_CACHE_SEG || 60),
    appUrl,
  };
}
