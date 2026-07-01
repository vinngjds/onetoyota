## Escopo

1. **Dashboard = visão da LT** (mantido como está). Uma visão de Gestão será criada em outro turno.
2. **Sidebar da LT**: remover os 4 links de módulos. Manter apenas **Dashboard** e **Histórico**. Cards do Dashboard continuam clicáveis e abrem `/modulo/$slug`.
3. **Sidebar da Gestão**: mantém Consolidado, Lojas & LTs, Indicadores, Metas.
4. **Cadastro das 21 lojas** (sem código, sem LT): Vila Velha, Pampulha, Contagem, G. Valadares, Manhuaçu, Ipatinga, Juiz de Fora, Vitória, Linhares, Carandaí, Serra, Muriaé, Sete Lagoas, GAB, Uberlândia JP, Colatina, SIA, Cachoeiro, Uberaba, Patos, Épia, Taguatinga, Uberlândia JN.
5. **Cadastro dos indicadores** por módulo (pontuação / meta padrão / subgrupo). Unidades: `percent` (%), `currency` (R$), `number`, `boolean` (SIM/NÃO).

### Segurança, Qualidade e ESG (12 pts)
- **NPS de Vendas**: Média Móvel (2 / 96%), Média Trimestral (1 / 96%)
- **NPS de Serviços**: Média Móvel (2 / 92%), Média Trimestral (1 / 92%)
- **FIR**: Média Móvel (1 / 93%), Média Trimestral (0,5 / 93%)
- **FIR de Reparo**: Média Móvel (1 / 90%), Média Trimestral (0,5 / 90%)
- **ESG Programs** (boolean): 100% KPI's Ambientais (0,20), 100% DERAP (0,20), ISO 14001 (0,50), Relatório Sustentabilidade (0,10)
- **Trilha de Vendas Online**: Trilha Consultor de Vendas VN (0,10 / 80%), Trilha Consultor de Vendas VD (0,03 / 80%), Trilha Entregador Técnico (0,03 / 2), Trilha Vendas EAD (0,10 / 100%)
- **Trilha de Vendas Presencial**: Consultor de Vendas VN (0,12 / 2), Avaliador de Usados (0,12 / 1), Novos Produtos e Processos 2026 (0,10 / 100%)
- **Trilha de Pós-Vendas Online**: Trilha Representante CR (0,10 / 1), Trilha de Serviços EAD (0,10 / 100%)
- **Trilha de Pós-Vendas Presencial**: Consultor de Serviços (0,20 / 60%), Representante CR (0,10 / 1), Novos Produtos e Processos 2026 (0,10 / 100%)
- **Team GP Online**: G4 (0,04 / 80%), G3 (0,04 / 60%), G2 (EL+MO+CH) (0,04 / 40%), G1 (MS+ESP) (0,04 / 2), Trilha Pré-LQS (0,04 / 2), Trilha LQS (0,04 / 1)
- **Team GP Presencial**: G4 (0,10 / 80%), G3 (0,10 / 2), G2 (EL) (0,10 / 1), G2 (EL+MO+CH) (0,10 / 1), G1 (MS+ESP) (0,10 / 1), LQS (0,06 / 1)

### Vendas (23 pts)
- **Vendas Varejo**: Yaris Cross (0), Corolla SD (3/6), Corolla Cross (3/17), Hilux (5/14), SW4 (1/9), RAV4 (1/9)
- **Vendas Diretas**: Faturamento Hilux (4/14), Faturamento Hiace Commuter (2/2), Cancelamento Hilux (1/2,80)
- **Collaboration** (sem subgrupo): (1/30,06)
- **Ciclo Toyota**: Penetração (1/8,25), Renovação (1/4%)

### Retenção (30 pts)
Retenção Total (11/100%), CPUS CSR+CSP (4/1503), TKT Médio CSR+CSP (2/R$1.200), BPUS (4/114), Retenção Funilaria CFS (3/37,97%), TKT Médio Funilaria (2/R$14.000), Toyota 10 (3/272), Agendamento Ativo CRM (1/20%).

### Value Chain (35 pts)
Seminovo Certificado TCUV (4/12), Seminovo Certificado Simplificada (1/0), Ciclo Toyota Usados (1/9%), Venda Usados Toyota (2/35%), Trade-in (2/22), Acessórios PNV (3/R$228.900), Acessórios % Genuínos (1/90%), **Revisão na Medida**: 03 ou mais revisões (2/10,05) + a partir da 4ª (2/4,02), Times Sales (2/75%), Consórcio Toyota (2/9), Seguro Toyota Novos (2/9,35), Seguro Toyota Renovação (1/75%), KINTO One Fleet Net Bookings (2/100%), KINTO One Fleet Gross Bookings (1/100%), KINTO One Personal (2/2), KINTO Share Bookings (1/20), KINTO Share Tx Ocupação (1/50%), NPS KINTO (1/93%), Onboarding Connected e Renovação (2/90%).

## Detalhes técnicos

- **AppShell** (`src/components/AppShell.tsx`): remover o array `MODULE_LINKS` do render para LT; manter Dashboard e Histórico. Bloco `if (isGestao)` intacto. Rota `/modulo/$slug` permanece (acessada via cards do Dashboard).
- **Migração 1 – lojas**: INSERT em `stores(name)` para as 21 lojas.
- **Migração 2 – indicadores**: INSERT em `indicators(module_id, name, subgroup, max_points, default_target, unit, sort_order)` resolvendo `module_id` via `(SELECT id FROM modules WHERE slug = ...)`.
- Nada muda em RLS, Histórico, tela de módulo ou lógica de scoring.
