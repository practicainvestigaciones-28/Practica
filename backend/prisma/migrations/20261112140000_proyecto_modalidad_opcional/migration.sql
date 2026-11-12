-- Un proyecto histórico (anterior al sistema) puede no tener modalidad: el formato antiguo no la trae y no se inventa una.
ALTER TABLE "proyectos" ALTER COLUMN "id_modalidad_proyecto" DROP NOT NULL;
