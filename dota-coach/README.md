# Ancient · Dota Replay Coach

Aplicação local para consultar partidas de Dota 2 pelo ID e receber um relatório em português com OpenAI. O projeto original na raiz foi preservado.

## Executar

**Windows:** extraia o ZIP e abra `INICIAR-WINDOWS.cmd`. Com Node.js 24.5+ instalado, ele solicita a chave de forma oculta (se não houver configuração existente), inicia o servidor e abre o navegador. A chave digitada fica apenas na memória do processo, sem gravar `.env`; ela será solicitada novamente na próxima execução. O lançador Windows precisa ser executado no seu próprio computador e não foi testado neste ambiente Linux.

Requer **Node.js 24.5 ou mais recente**. Não há pacotes externos ou etapa de build.

```sh
cd /workspace/projeto-tcc/dota-coach
cp .env.example .env
# Edite .env localmente e defina DOTA_OPENAI_API_KEY.
npm start
```

O servidor escuta apenas na interface local, porta 3000 (ou `PORT`). Use seu navegador local na porta configurada. A interface permite consultar a partida sem chave OpenAI; a geração de relatórios exige uma chave válida e cota. O modelo padrão é `gpt-4.1-mini`, substituível por `OPENAI_MODEL` por um modelo que suporte Responses API e Structured Outputs. Não há fallback com relatório inventado.

O Node usa o proxy e a confiança TLS já configurados no ambiente (`--use-env-proxy`). Não desative validação de certificados. A chave fica no servidor, nunca no JavaScript da página. `.env` é ignorado pelo Git. Também é aceito `OPENAI_API_KEY` quando já fornecido por outro ambiente. No ambiente gerenciado use o nome `DOTA_OPENAI_API_KEY`: o prefixo `OPENAI_` é reservado na configuração de segredos da plataforma.

## Usar

1. Informe o ID da partida (Dota 2 → histórico → detalhes).
2. Para analisar **qualquer jogador**, informe o nome completo do herói (por exemplo `Axe` ou `Anti-Mage`); ele tem prioridade sobre o perfil. Alternativamente informe um SteamID64, ID OpenDota ou link público `steamcommunity.com/profiles/...`. Seu perfil está preenchido por conveniência, mas pode ser trocado ou apagado. Sem identificação, escolha qualquer jogador entre os dez participantes; também é possível trocar a seleção antes de gerar uma nova análise. Jogadores anonimizados podem ser selecionados pelo herói.
3. Se faltarem eventos detalhados, solicite processamento do replay. Aguarde e use **Atualizar**; o OpenDota pode levar minutos e replays antigos podem ter expirado. A solicitação não garante sucesso e não precisa ser repetida continuamente.
4. Escolha um foco, autorize o envio dos dados à OpenAI e gere a análise. Cada chamada consome cota da chave configurada.
5. Consulte evidências, recomendações, nível de certeza e plano de treino; exporte Markdown ou JSON.

Os dados públicos e eventos processados vêm do OpenDota. É possível habilitar **Expose Public Match Data** nas opções sociais do Dota e vincular sua conta ao OpenDota; partidas privadas, não indexadas ou replays expirados podem continuar indisponíveis. `OPENDOTA_API_KEY` é opcional e pode aumentar a cota conforme seu plano.

## O que é e o que não é analisado

- Estatísticas, evolução de ouro/XP/last hits, compras, abates, buybacks, wards, runas, objetivos e lutas quando esses campos existem na resposta. A cobertura aparece no relatório.
- O arquivo `.dem` não é baixado ou interpretado diretamente por este software: o OpenDota é o serviço de processamento de replay. Um ID não garante acesso a cada ação, comandos, câmera, comunicação, posições contínuas ou visão completa. Não há análise quadro a quadro nem promessa de identificar todos os erros.
- A IA recebe apenas o jogador selecionado e evidências numeradas. O backend valida o esquema, os IDs e os timestamps citados; isso evita referências inexistentes, mas não prova que a interpretação da IA está correta. Recomendações continuam sujeitas a revisão humana.
- Nomes, chat e ID de conta não são enviados à OpenAI. São enviados o ID da partida, estatísticas/eventos do jogador, foco informado e contexto de patch/meta. Não coloque informações sensíveis no foco. As requisições OpenAI usam `store: false`; isso não substitui as políticas de retenção aplicáveis à sua conta. O app não mantém histórico de análises em disco e armazena consultas externas em cache de memória por até 5 minutos (catálogo de heróis por 1 hora; partida por 30 segundos).

## Patch e meta

Cada análise consulta o catálogo comunitário `odota/dotaconstants`, estatísticas agregadas de heróis, benchmarks e popularidade de itens do OpenDota, além das notícias oficiais de Dota 2 pelo Steam. Fontes e horários de consulta são exibidos; indisponibilidade de uma fonte gera um aviso.

**O catálogo pode atrasar e não incluir subpatches.** O app distingue patch da partida e versão mais recente conhecida no catálogo. Não confirma automaticamente que essa versão é o patch vigente, e as estatísticas agregadas não têm janela temporal garantida. Notícias oficiais fornecem contexto recente, mas não são um banco completo de regras de habilidades/itens. Assim, o app não deve ser tratado como confirmação de meta exato do patch atual. A IA é instruída a explicitar essas limitações e não condenar decisões antigas com regras posteriores.

## Rede e segurança

Destinos HTTPS necessários:

- `api.opendota.com`: partida, processamento e estatísticas;
- `raw.githubusercontent.com`: heróis, itens e patches;
- `api.steampowered.com`: notícias oficiais;
- `api.openai.com`: análise.

No onboarding, OpenDota e OpenAI estavam bloqueados pela política de rede; as permissões e o requisito de chave foram salvos no rascunho do ambiente. Salvar o rascunho não aplica essas mudanças. Revise e salve as configurações, forneça o segredo no campo seguro e reinicie o processo quando necessário. Nunca envie chaves pelo chat.

Este servidor é **para uso individual local**: possui validação de entradas, limites por minuto, limite de duas análises simultâneas, proteção de origem/Host, CSP e escape de texto na interface. Não publique na Internet sem autenticação, TLS, cotas por usuário e revisão de infraestrutura. O app não serve arquivos `.env` ou código do servidor. As mensagens de erro não repassam respostas externas que possam conter dados sensíveis.

## Validação

```sh
npm test
```

Os testes usam APIs simuladas, explicitamente; não consomem créditos. Exercitam seleção de jogador, SteamID64, eventos, dados ausentes, esquema/evidências, requisição OpenAI, falhas de rede/chave, consentimento, rotas e segurança HTTP. A validação real de uma partida exige rede liberada e chave com cota; não é substituída pelos mocks. A interface também pode ser testada em DOM; renderização visual em navegador exige um navegador disponível.
