insert into public.agency_public_settings(id,agency_name,creci,phone,whatsapp,public_email,public_address,instagram,facebook,tiktok,youtube,logo_url)
values(1,'Matos Negócios Imobiliários',null,null,null,null,null,null,null,null,null,null)
on conflict(id) do update set agency_name=excluded.agency_name;

insert into public.cities(id,name,state,state_code,slug,active,created_at) values
('8558b9e7-1a5f-4bfe-a108-090a54a4ddca','Ressaquinha/MG','Minas Gerais','MG','ressaquinha-mg-mg',true,'2026-09-13T14:11:38.139982+00:00'),
('fb50154f-fa1e-45e5-b60a-7855bb46bcae','Ressaquinha','Minas Gerais','MG','ressaquinha-mg',true,'2026-09-13T12:54:06.611244+00:00')
on conflict(id) do nothing;

insert into public.neighborhoods(id,city_id,name,slug,active,created_at) values
('594a7435-3a8d-4925-9392-85f9fef8ea85','8558b9e7-1a5f-4bfe-a108-090a54a4ddca','Simão Tamm','simao-tamm',true,'2026-09-13T14:11:38.911128+00:00'),
('82d67e42-a9be-4bbe-9e0b-18dc25ddf577','fb50154f-fa1e-45e5-b60a-7855bb46bcae','Zona Rural','zona-rural',true,'2026-09-13T14:13:36.663003+00:00'),
('7c5a453f-4396-4399-b7de-92c982e98df3','8558b9e7-1a5f-4bfe-a108-090a54a4ddca','Zona Rural','zona-rural',true,'2026-09-14T11:35:53.033676+00:00'),
('8fc9ff13-b6ff-437d-8ce8-24e143065f3b','fb50154f-fa1e-45e5-b60a-7855bb46bcae','Volta Grande','volta-grande',true,'2026-09-13T12:54:06.611244+00:00')
on conflict(id) do nothing;

insert into public.features(id,key,label,active,created_at) values
('5feab421-1c40-442a-a0ec-e0a4575d1858','terraco','Terraço',true,'2026-09-13T12:54:06.611244+00:00')
on conflict(id) do nothing;;
