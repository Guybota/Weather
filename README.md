# Tempo

Meteorologia para Portugal com dados reais do IPMA. Interface responsiva, favoritos, gráficos de temperatura/chuva/vento, previsão diária de 10 dias, avisos por região, modo claro/escuro e instalação como PWA.

## Desenvolvimento

Node.js 22.12+ (ou 24) e npm.

```sh
npm ci
npm run dev
```

Abre http://127.0.0.1:5173. O servidor local executa a mesma API usada pelo Worker em produção. Não é necessária uma chave do IPMA.

```sh
npm test
npm run build
npm run preview
npm run check:ipma
```

`check:ipma` é uma verificação manual com acesso à rede. Os testes automáticos usam respostas controladas e não dependem da disponibilidade do IPMA.

## Publicar na Cloudflare

1. Cria ou usa uma conta Cloudflare no plano Workers Free.
2. Executa `npx wrangler login` para autenticar no browser.
3. Executa `npm run deploy`. A Cloudflare fornece o endereço HTTPS `workers.dev`; não é necessário comprar um domínio.
4. Para publicação automática, liga este repositório a **Workers & Pages → Create application → Import a repository**. Build command: `npm run build`. Deploy command: `npx wrangler deploy`. Branch: `main`.

O projeto usa Worker + Static Assets, sem KV, D1, R2 ou serviços pagos. Os pedidos estáticos são gratuitos; os pedidos `/api/*` contam para as quotas do Worker, mesmo quando o upstream é servido por cache. O cache reduz consultas ao IPMA, não elimina invocações ao Worker. Confirma os limites atuais na [Cloudflare](https://developers.cloudflare.com/workers/platform/limits/). O plano Free bloqueia pedidos que excedam as quotas; não atives um plano pago se pretendes manter custo zero.

## Instalar no telemóvel

- Android: abre o endereço publicado no Chrome e escolhe **Instalar aplicação** ou **Adicionar ao ecrã principal**.
- iPhone: Safari → Partilhar → **Adicionar ao ecrã principal**. Ativa **Abrir como app web**, se disponível.

A PWA guarda a interface e a última resposta meteorológica no dispositivo. Dados meteorológicos guardados têm validade máxima de 24 horas; a app identifica respostas desatualizadas e não apresenta avisos guardados como confirmação de segurança. A instalação e o service worker devem ser verificados no build de produção, não no servidor de desenvolvimento.

## Dados e limites

Fonte: [IPMA, I.P.](https://www.ipma.pt/). Aplicação independente, sem afiliação ao IPMA.

Endpoints usados:

- `public-data/forecast/locations.json`
- `public-data/forecast/aggregate/{globalIdLocal}.json`
- `public-data/forecast/weathertypes.json`
- `public-data/warnings/warnings_www.json`
- `open-data/observation/meteorology/stations/obs-surface.geojson`

Os endpoints `public-data` são usados pelo próprio site do IPMA, mas não têm o mesmo contrato documentado dos serviços `open-data`; o adaptador valida o formato e permite alterar esta integração sem modificar a interface. Em outubro de 2026, a previsão agregada fornece 10 dias diários, cerca de 3 dias horários e períodos de 3 horas nos dias seguintes. A app respeita os períodos reais; não cria previsões horárias por interpolação. Parâmetros indisponíveis são apresentados como “—”.

As datas/horas instantâneas do IPMA são UTC, convertidas para Europe/Lisbon ou Atlantic/Azores. As datas da previsão diária são rótulos de calendário e não mudam para o dia anterior nos Açores. Uma observação só aparece como temperatura observada quando existe uma estação até 50 km com dados das últimas 3 horas; o local, distância e hora são sempre indicados. Na ausência de uma observação adequada, a temperatura é explicitamente apresentada como prevista.

Cache: localidades e tipos de tempo 24h; previsão 20min; avisos 3min; observações 10min. Última resposta válida no servidor até 24h, sempre marcada como desatualizada quando usada após falha. Favoritos e preferências são guardados apenas neste browser; não há contas nem analytics.

Consulta as [condições do IPMA](https://api.ipma.pt/) antes de reutilização comercial. O IPMA solicita identificação da fonte e comunicação do uso por email. Este projeto não envia emails automaticamente.

## Próximas melhorias

Informação marítima, mapas e notificações push. Não são funcionalidades implementadas nesta versão.
