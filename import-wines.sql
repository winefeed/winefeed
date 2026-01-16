-- IMPORTERA 50 VINER (representativt urval för MVP-test)
-- Kör detta i Supabase SQL Editor efter att du kört schema

INSERT INTO wines (namn, producent, land, region, pris_sek, beskrivning, druva, ekologisk, lagerstatus) VALUES
('Barolo DOCG 2019', 'Marchesi di Barolo', 'Italien', 'Piemonte', 385, 'Kraftfull Nebbiolo med toner av körsbär, tryffel och läder. Passar vilt, ostklass och röda köttgryter.', 'Nebbiolo', false, 'tillgänglig'),
('Barolo DOCG 2018', 'Marchesi di Barolo', 'Italien', 'Piemonte', 395, 'Kraftfull Nebbiolo med toner av körsbär, tryffel och läder. Passar vilt, ostklass och röda köttgryter.', 'Nebbiolo', false, 'tillgänglig'),
('Barolo DOCG 2017', 'Marchesi di Barolo', 'Italien', 'Piemonte', 405, 'Kraftfull Nebbiolo med toner av körsbär, tryffel och läder. Passar vilt, ostklass och röda köttgryter.', 'Nebbiolo', false, 'tillgänglig'),
('Chianti Classico Riserva DOCG 2020', 'Castello di Ama', 'Italien', 'Toscana', 215, 'Elegant Sangiovese med toner av körsbär, violer och läder. Perfekt till pasta med tomatsås och grillat kött.', 'Sangiovese', false, 'tillgänglig'),
('Chianti Classico Riserva DOCG 2019', 'Castello di Ama', 'Italien', 'Toscana', 225, 'Elegant Sangiovese med toner av körsbär, violer och läder. Perfekt till pasta med tomatsås och grillat kött.', 'Sangiovese', false, 'tillgänglig'),
('Chianti Classico Riserva DOCG 2018', 'Castello di Ama', 'Italien', 'Toscana', 235, 'Elegant Sangiovese med toner av körsbär, violer och läder. Perfekt till pasta med tomatsås och grillat kött.', 'Sangiovese', false, 'tillgänglig'),
('Chablis Premier Cru 2021', 'William Fèvre', 'Frankrike', 'Bourgogne', 265, 'Mineralisk Chardonnay med toner av citrus och vit persika. Utmärkt till skaldjur och vit fisk.', 'Chardonnay', false, 'tillgänglig'),
('Chablis Premier Cru 2020', 'William Fèvre', 'Frankrike', 'Bourgogne', 275, 'Mineralisk Chardonnay med toner av citrus och vit persika. Utmärkt till skaldjur och vit fisk.', 'Chardonnay', false, 'tillgänglig'),
('Chablis Premier Cru 2022', 'William Fèvre', 'Frankrike', 'Bourgogne', 255, 'Mineralisk Chardonnay med toner av citrus och vit persika. Utmärkt till skaldjur och vit fisk.', 'Chardonnay', false, 'tillgänglig'),
('Rioja Reserva DOCa 2018', 'Marqués de Riscal', 'Spanien', 'Rioja', 185, 'Balanserad Tempranillo med toner av röda bär, vanilj och ek. Passar lamm och tapas.', 'Tempranillo', false, 'tillgänglig'),
('Rioja Reserva DOCa 2017', 'Marqués de Riscal', 'Spanien', 'Rioja', 195, 'Balanserad Tempranillo med toner av röda bär, vanilj och ek. Passar lamm och tapas.', 'Tempranillo', false, 'tillgänglig'),
('Rioja Reserva DOCa 2016', 'Marqués de Riscal', 'Spanien', 'Rioja', 205, 'Balanserad Tempranillo med toner av röda bär, vanilj och ek. Passar lamm och tapas.', 'Tempranillo', false, 'tillgänglig'),
('Pouilly-Fumé 2022', 'Domaine Didier Dagueneau', 'Frankrike', 'Loire', 345, 'Aromatisk Sauvignon Blanc med toner av färsk frukt och mineraler. Perfekt till getost och skaldjur.', 'Sauvignon Blanc', true, 'tillgänglig'),
('Pouilly-Fumé 2021', 'Domaine Didier Dagueneau', 'Frankrike', 'Loire', 355, 'Aromatisk Sauvignon Blanc med toner av färsk frukt och mineraler. Perfekt till getost och skaldjur.', 'Sauvignon Blanc', true, 'tillgänglig'),
('Amarone della Valpolicella DOCG 2017', 'Tommasi', 'Italien', 'Veneto', 425, 'Kraftfull och komplex med toner av mörka bär, choklad och kryddor. Passar ostklass och vilt.', 'Corvina, Rondinella', false, 'tillgänglig'),
('Amarone della Valpolicella DOCG 2016', 'Tommasi', 'Italien', 'Veneto', 435, 'Kraftfull och komplex med toner av mörka bär, choklad och kryddor. Passar ostklass och vilt.', 'Corvina, Rondinella', false, 'tillgänglig'),
('Châteauneuf-du-Pape 2019', 'Domaine du Vieux Télégraphe', 'Frankrike', 'Rhône', 395, 'Komplex blend med toner av mörka bär, örter och kryddor. Perfekt till grillat kött.', 'Grenache, Syrah, Mourvèdre', false, 'tillgänglig'),
('Châteauneuf-du-Pape 2018', 'Domaine du Vieux Télégraphe', 'Frankrike', 'Rhône', 405, 'Komplex blend med toner av mörka bär, örter och kryddor. Perfekt till grillat kött.', 'Grenache, Syrah, Mourvèdre', false, 'tillgänglig'),
('Sancerre 2022', 'Pascal Jolivet', 'Frankrike', 'Loire', 195, 'Fräsch Sauvignon Blanc med toner av citrus och gröna äpplen. Perfekt till getost.', 'Sauvignon Blanc', false, 'tillgänglig'),
('Sancerre 2021', 'Pascal Jolivet', 'Frankrike', 'Loire', 205, 'Fräsch Sauvignon Blanc med toner av citrus och gröna äpplen. Perfekt till getost.', 'Sauvignon Blanc', false, 'tillgänglig'),
('Brunello di Montalcino DOCG 2017', 'Banfi', 'Italien', 'Toscana', 450, 'Elegant Sangiovese Grosso med toner av körsbär, tobak och läder. Perfekt till vilt och röda köttgryter.', 'Sangiovese', false, 'tillgänglig'),
('Barbaresco DOCG 2019', 'Gaja', 'Italien', 'Piemonte', 520, 'Raffinerad Nebbiolo med toner av rosor, körsbär och tryffel. Passar lamm och ostklass.', 'Nebbiolo', false, 'tillgänglig'),
('Valpolicella Ripasso 2020', 'Zenato', 'Italien', 'Veneto', 165, 'Medelfyllig med toner av körsbär, choklad och kryddor. Passar pasta och pizza.', 'Corvina', false, 'tillgänglig'),
('Montepulciano d''Abruzzo 2021', 'Masciarelli', 'Italien', 'Abruzzo', 125, 'Fruktdriven med toner av björnbär och svartpeppar. Perfekt till pizza och pasta.', 'Montepulciano', false, 'tillgänglig'),
('Nero d''Avola 2022', 'Planeta', 'Italien', 'Sicilien', 145, 'Kraftfull med toner av mörka bär och kryddor. Passar grill och pasta.', 'Nero d''Avola', false, 'tillgänglig'),
('Côtes du Rhône Villages 2021', 'Guigal', 'Frankrike', 'Rhône', 155, 'Medelfyllig med toner av röda bär och kryddor. Perfekt till grill.', 'Grenache, Syrah', false, 'tillgänglig'),
('Crozes-Hermitage 2020', 'Jaboulet', 'Frankrike', 'Rhône', 225, 'Elegant Syrah med toner av violer, svartpeppar och oliver. Passar lamm.', 'Syrah', false, 'tillgänglig'),
('Gigondas 2019', 'Domaine Santa Duc', 'Frankrike', 'Rhône', 285, 'Kraftfull blend med toner av mörka bär, örter och lakrits. Passar vilt.', 'Grenache, Syrah', false, 'tillgänglig'),
('Cornas 2018', 'Auguste Clape', 'Frankrike', 'Rhône', 425, 'Kraftfull Syrah med toner av svarta bär, bacon och tryffel. Passar oxfilé.', 'Syrah', false, 'tillgänglig'),
('Hermitage 2017', 'Jaboulet La Chapelle', 'Frankrike', 'Rhône', 650, 'Majestätisk Syrah med toner av cassis, violer och tryffel. Passar vilt och ostklass.', 'Syrah', false, 'tillgänglig'),
('Pomerol 2018', 'Château Gazin', 'Frankrike', 'Bordeaux', 485, 'Elegant Merlot-dominerad med toner av plommon, choklad och ek. Passar oxfilé.', 'Merlot, Cabernet Franc', false, 'tillgänglig'),
('Saint-Émilion Grand Cru 2017', 'Château Figeac', 'Frankrike', 'Bordeaux', 565, 'Komplex blend med toner av cassis, ceder och tobak. Passar lamm.', 'Merlot, Cabernet Franc', false, 'tillgänglig'),
('Margaux 2016', 'Château Palmer', 'Frankrike', 'Bordeaux', 850, 'Aristokratisk blend med toner av cassis, violer och ceder. Passar vilt.', 'Cabernet Sauvignon, Merlot', false, 'tillgänglig'),
('Pauillac 2015', 'Château Pichon Baron', 'Frankrike', 'Bordeaux', 920, 'Kraftfull Cabernet med toner av cassis, ceder och grafitt. Perfekt till oxfilé.', 'Cabernet Sauvignon', false, 'tillgänglig'),
('Meursault 2020', 'Domaine Roulot', 'Frankrike', 'Bourgogne', 585, 'Rik Chardonnay med toner av hasselnöt, smör och mineraler. Passar hummer.', 'Chardonnay', false, 'tillgänglig'),
('Puligny-Montrachet Premier Cru 2019', 'Leflaive', 'Frankrike', 'Bourgogne', 725, 'Elegant Chardonnay med toner av citrus, vit persika och mandel. Perfekt till kräftor.', 'Chardonnay', false, 'tillgänglig'),
('Chassagne-Montrachet 2021', 'Ramonet', 'Frankrike', 'Bourgogne', 465, 'Mineralisk Chardonnay med toner av citrus och honung. Passar skaldjur.', 'Chardonnay', false, 'tillgänglig'),
('Gevrey-Chambertin 2019', 'Domaine Fourrier', 'Frankrike', 'Bourgogne', 525, 'Elegant Pinot Noir med toner av körsbär, tryffel och underskog. Passar fågel.', 'Pinot Noir', false, 'tillgänglig'),
('Vosne-Romanée 2018', 'Méo-Camuzet', 'Frankrike', 'Bourgogne', 685, 'Silkig Pinot Noir med toner av rosor, körsbär och kryddor. Perfekt till and.', 'Pinot Noir', false, 'tillgänglig'),
('Nuits-Saint-Georges 2017', 'Domaine de l''Arlot', 'Frankrike', 'Bourgogne', 445, 'Strukturerad Pinot Noir med toner av svarta bär och tryffel. Passar vilt.', 'Pinot Noir', false, 'tillgänglig'),
('Priorat 2018', 'Clos Mogador', 'Spanien', 'Priorat', 485, 'Kraftfull blend med toner av mörka bär, lakrits och mineraler. Passar lamm.', 'Grenache, Carignan, Syrah', false, 'tillgänglig'),
('Ribera del Duero Crianza 2019', 'Vega Sicilia Alión', 'Spanien', 'Ribera del Duero', 425, 'Elegant Tempranillo med toner av körsbär, ceder och vanilj. Passar oxfilé.', 'Tempranillo', false, 'tillgänglig'),
('Rioja Gran Reserva 2012', 'La Rioja Alta 904', 'Spanien', 'Rioja', 365, 'Mogen Tempranillo med toner av körsbär, ek och tobak. Perfekt till lamm.', 'Tempranillo', false, 'tillgänglig'),
('Rías Baixas Albariño 2022', 'Pazo de Señorans', 'Spanien', 'Rías Baixas', 245, 'Fräsch Albariño med toner av persika, citrus och mineraler. Perfekt till skaldjur.', 'Albariño', false, 'tillgänglig'),
('Rueda Verdejo 2022', 'Marqués de Riscal', 'Spanien', 'Rueda', 135, 'Aromatisk Verdejo med toner av färsk frukt och örter. Passar tapas.', 'Verdejo', false, 'tillgänglig'),
('Douro Reserva 2019', 'Quinta do Crasto', 'Portugal', 'Douro', 285, 'Kraftfull blend med toner av mörka bär och ek. Passar grill.', 'Touriga Nacional, Tinta Roriz', false, 'tillgänglig'),
('Dão Reserva 2018', 'Quinta dos Roques', 'Portugal', 'Dão', 195, 'Elegant blend med toner av röda bär och kryddor. Perfekt till lamm.', 'Touriga Nacional, Alfrocheiro', false, 'tillgänglig'),
('Vinho Verde 2022', 'Quinta da Aveleda', 'Portugal', 'Vinho Verde', 115, 'Lätt och fräsch med toner av citrus och äpple. Perfekt till skaldjur.', 'Loureiro, Trajadura', false, 'tillgänglig'),
('Marlborough Sauvignon Blanc 2022', 'Cloudy Bay', 'Nya Zeeland', 'Marlborough', 265, 'Intensiv Sauvignon Blanc med toner av passionfrukt och citrus. Passar skaldjur.', 'Sauvignon Blanc', false, 'tillgänglig'),
('Central Otago Pinot Noir 2020', 'Felton Road', 'Nya Zeeland', 'Central Otago', 485, 'Elegant Pinot Noir med toner av körsbär, rosor och kryddor. Perfekt till and.', 'Pinot Noir', false, 'tillgänglig');

-- Skapa en standardleverantör för alla viner i MVP
INSERT INTO suppliers (namn, kontakt_email, telefon, normalleveranstid_dagar) VALUES
('Vingruppen AB', 'order@vingruppen.se', '08-123 456 78', 3),
('Wineworld Sverige', 'info@wineworld.se', '08-234 567 89', 2),
('Vinkompaniet', 'kontakt@vinkompaniet.se', '08-345 678 90', 5);

-- Koppla alla viner till första leverantören (för MVP)
INSERT INTO wine_suppliers (wine_id, supplier_id)
SELECT w.id, s.id
FROM wines w
CROSS JOIN (SELECT id FROM suppliers LIMIT 1) s;
