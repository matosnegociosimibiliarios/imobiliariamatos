-- Corrige textos de checklists que foram persistidos com codificação incorreta
update public.property_documents set label=case doc_key
when 'owner_id' then 'Documento de identificação do proprietário'
when 'authorization' then 'Autorização para venda / locação'
when 'registration' then 'Matrícula atualizada do imóvel'
when 'municipal_taxes' then 'IPTU / tributos municipais'
when 'encumbrances' then 'Certidão / situação de ônus'
when 'regularization' then 'Regularidade da construção / averbação'
else label end
where doc_key in ('owner_id','authorization','registration','municipal_taxes','encumbrances','regularization');

update public.deal_documents set label=case
when party='buyer' and doc_key='personal_id' then 'Documento de identificação'
when party='buyer' and doc_key='cpf' then 'CPF'
when party='buyer' and doc_key='address' then 'Comprovante de endereço'
when party='buyer' and doc_key='civil_status' then 'Documento de estado civil'
when party='buyer' and doc_key='income' then 'Comprovante de renda / financiamento'
when party='seller' and doc_key='personal_id' then 'Documento de identificação'
when party='seller' and doc_key='cpf' then 'CPF'
when party='seller' and doc_key='address' then 'Comprovante de endereço'
when party='seller' and doc_key='civil_status' then 'Documento de estado civil'
when party='seller' and doc_key='property_registration' then 'Matrícula atualizada do imóvel'
when party='seller' and doc_key='property_encumbrances' then 'Certidão / situação de ônus do imóvel'
when party='seller' and doc_key='municipal_taxes' then 'Situação de IPTU / tributos do imóvel'
when party='transaction' and doc_key='purchase_contract' then 'Contrato / compromisso de compra e venda'
when party='transaction' and doc_key='financing' then 'Documentação do financiamento'
when party='transaction' and doc_key='deed' then 'Escritura'
when party='transaction' and doc_key='registry' then 'Registro do imóvel'
else label end;

create or replace function public.seed_property_documents()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 insert into public.property_documents(property_id,doc_key,label,display_order) values
 (new.property_id,'owner_id','Documento de identificação do proprietário',10),
 (new.property_id,'authorization','Autorização para venda / locação',20),
 (new.property_id,'registration','Matrícula atualizada do imóvel',30),
 (new.property_id,'municipal_taxes','IPTU / tributos municipais',40),
 (new.property_id,'encumbrances','Certidão / situação de ônus',50),
 (new.property_id,'regularization','Regularidade da construção / averbação',60)
 on conflict(property_id,doc_key) do nothing; return new; end; $$;
revoke execute on function public.seed_property_documents() from public,anon,authenticated;

create or replace function public.seed_deal_documents()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
 insert into public.deal_documents(deal_id,party,doc_key,label,display_order) values
 (new.id,'buyer','personal_id','Documento de identificação',10),(new.id,'buyer','cpf','CPF',20),(new.id,'buyer','address','Comprovante de endereço',30),(new.id,'buyer','civil_status','Documento de estado civil',40),(new.id,'buyer','income','Comprovante de renda / financiamento',50),
 (new.id,'seller','personal_id','Documento de identificação',10),(new.id,'seller','cpf','CPF',20),(new.id,'seller','address','Comprovante de endereço',30),(new.id,'seller','civil_status','Documento de estado civil',40),(new.id,'seller','property_registration','Matrícula atualizada do imóvel',50),(new.id,'seller','property_encumbrances','Certidão / situação de ônus do imóvel',60),(new.id,'seller','municipal_taxes','Situação de IPTU / tributos do imóvel',70),
 (new.id,'transaction','purchase_contract','Contrato / compromisso de compra e venda',10),(new.id,'transaction','financing','Documentação do financiamento',20),(new.id,'transaction','deed','Escritura',30),(new.id,'transaction','registry','Registro do imóvel',40)
 on conflict(deal_id,party,doc_key) do nothing; return new; end; $$;
revoke execute on function public.seed_deal_documents() from public,anon,authenticated;