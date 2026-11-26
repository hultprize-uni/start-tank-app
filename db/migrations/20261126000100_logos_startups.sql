-- Logos de las startups del evento. Los archivos viven en public/startups/ y se sirven desde la
-- propia aplicación. Repetible: solo actualiza por nombre.
update startup set logo_url = '/startups/' || v.archivo
  from (values
    ('Monedita', 'monedita.png'),
    ('Rockie OS', 'rockie-os.png'),
    ('Provdu', 'provdu.png'),
    ('Agrolif', 'agrolif.png'),
    ('Tracta', 'tracta.png')
  ) as v(nombre, archivo)
 where startup.nombre = v.nombre;
