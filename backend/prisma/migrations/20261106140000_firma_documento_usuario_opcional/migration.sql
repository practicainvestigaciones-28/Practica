-- El Vicerrector del acta de cierre puede figurar antes de que exista una cuenta con ese rol: quien firma queda registrado al firmar.
ALTER TABLE "firma_documento" ALTER COLUMN "id_usuario" DROP NOT NULL;
