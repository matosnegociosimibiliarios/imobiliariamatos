-- =========================================================
-- MATOS NEGÓCIOS IMOBILIÁRIOS
-- VERSÃO 10.15 - TRANSFERÊNCIA DE CARTEIRA ENTRE USUÁRIOS
-- =========================================================
-- Esta versão permite que Proprietário/Administrador transfira
-- clientes, imóveis e demais registros atribuídos de um usuário
-- da equipe para outro, preservando histórico e auditoria.

-- Retorna um resumo da carteira atribuída a um usuário da empresa atual.
create or replace function public.team_portfolio_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role text;
  v_is_member boolean;
  v_result jsonb;
begin
  v_org := public.current_organization_id();
  v_role := public.current_team_role();

  if v_org is null then
    raise exception 'Empresa não encontrada para o usuário atual.';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'Você não tem permissão para consultar carteiras da equipe.';
  end if;

  select exists(
    select 1
    from public.organization_members m
    where m.organization_id = v_org
      and m.user_id = p_user_id
  ) into v_is_member;

  if not v_is_member then
    raise exception 'O usuário informado não pertence a esta empresa.';
  end if;

  select jsonb_build_object(
    'leads',        (select count(*) from public.leads where assigned_to = p_user_id),
    'properties',   (select count(*) from public.properties where assigned_to = p_user_id),
    'appointments', (select count(*) from public.appointments where assigned_to = p_user_id),
    'captures',     (select count(*) from public.owner_captures where assigned_to = p_user_id),
    'proposals',    (select count(*) from public.proposals where assigned_to = p_user_id),
    'deals',        (select count(*) from public.deals where assigned_to = p_user_id)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.team_portfolio_summary(uuid) to authenticated;

-- Transfere os tipos de registro escolhidos de um usuário para outro.
create or replace function public.transfer_team_portfolio(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_transfer_leads boolean default true,
  p_transfer_properties boolean default true,
  p_transfer_appointments boolean default true,
  p_transfer_captures boolean default true,
  p_transfer_proposals boolean default true,
  p_transfer_deals boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role text;
  v_from_member public.organization_members%rowtype;
  v_to_member public.organization_members%rowtype;
  v_leads integer := 0;
  v_properties integer := 0;
  v_appointments integer := 0;
  v_captures integer := 0;
  v_proposals integer := 0;
  v_deals integer := 0;
begin
  v_org := public.current_organization_id();
  v_role := public.current_team_role();

  if v_org is null then
    raise exception 'Empresa não encontrada para o usuário atual.';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'Somente Proprietário ou Administrador pode transferir carteiras.';
  end if;

  if p_from_user_id is null or p_to_user_id is null then
    raise exception 'Informe o usuário de origem e o usuário de destino.';
  end if;

  if p_from_user_id = p_to_user_id then
    raise exception 'Origem e destino precisam ser usuários diferentes.';
  end if;

  select * into v_from_member
  from public.organization_members
  where organization_id = v_org
    and user_id = p_from_user_id
  limit 1;

  if not found then
    raise exception 'O usuário de origem não pertence a esta empresa.';
  end if;

  select * into v_to_member
  from public.organization_members
  where organization_id = v_org
    and user_id = p_to_user_id
  limit 1;

  if not found then
    raise exception 'O usuário de destino não pertence a esta empresa.';
  end if;

  if v_to_member.status <> 'active' then
    raise exception 'O usuário de destino precisa estar ativo.';
  end if;

  if not (
    p_transfer_leads or p_transfer_properties or p_transfer_appointments
    or p_transfer_captures or p_transfer_proposals or p_transfer_deals
  ) then
    raise exception 'Selecione pelo menos um tipo de carteira para transferir.';
  end if;

  -- Os triggers da V10.14 atualizam assigned_by/assigned_at e registram
  -- cada alteração na auditoria automaticamente.
  if p_transfer_leads then
    update public.leads
       set assigned_to = p_to_user_id
     where assigned_to = p_from_user_id;
    get diagnostics v_leads = row_count;
  end if;

  if p_transfer_properties then
    update public.properties
       set assigned_to = p_to_user_id
     where assigned_to = p_from_user_id;
    get diagnostics v_properties = row_count;
  end if;

  if p_transfer_appointments then
    update public.appointments
       set assigned_to = p_to_user_id
     where assigned_to = p_from_user_id;
    get diagnostics v_appointments = row_count;
  end if;

  if p_transfer_captures then
    update public.owner_captures
       set assigned_to = p_to_user_id
     where assigned_to = p_from_user_id;
    get diagnostics v_captures = row_count;
  end if;

  if p_transfer_proposals then
    update public.proposals
       set assigned_to = p_to_user_id
     where assigned_to = p_from_user_id;
    get diagnostics v_proposals = row_count;
  end if;

  if p_transfer_deals then
    update public.deals
       set assigned_to = p_to_user_id
     where assigned_to = p_from_user_id;
    get diagnostics v_deals = row_count;
  end if;

  return jsonb_build_object(
    'leads', v_leads,
    'properties', v_properties,
    'appointments', v_appointments,
    'captures', v_captures,
    'proposals', v_proposals,
    'deals', v_deals,
    'total', v_leads + v_properties + v_appointments + v_captures + v_proposals + v_deals
  );
end;
$$;

grant execute on function public.transfer_team_portfolio(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

notify pgrst, 'reload schema';
