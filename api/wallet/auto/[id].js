
const jwt = require("jsonwebtoken");

export default async function handler(req, res) {
  const { id } = req.query;

  const polizas = require("../../../data/auto.json");
  const aseguradoras = require("../../../data/aseguradoras-auto.json");

  const poliza = polizas[id];
  const aseguradora = aseguradoras[poliza.aseguradora_id];

  const payload = {
    iss: process.env.GOOGLE_CLIENT_EMAIL,
    aud: "google",
    typ: "savetowallet",
    payload: {
      genericObjects: [
        {
          id: `${process.env.ISSUER_ID}.${id}`,
          classId: `${process.env.ISSUER_ID}.tactika_auto`,
          state: "ACTIVE",

          cardTitle: {
            defaultValue: {
              language: "es",
              value: poliza.contratante
            }
          },

          header: {
            defaultValue: {
              language: "es",
              value: "Seguro Auto"
            }
          },

          subheader: {
            defaultValue: {
              language: "es",
              value: aseguradora.nombre
            }
          },

          textModulesData: [
            {
              header: "Vehículo",
              body: poliza.vehiculo
            },
            {
              header: "Póliza",
              body: poliza.poliza
            },
            {
              header: "Vigencia",
              body: poliza.vigencia_texto.replace("<br>", " - ")
            }
          ],

          barcode: {
            type: "QR_CODE",
            value: poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`
          }
        }
      ]
    }
  };

  const token = jwt.sign(payload, process.env.GOOGLE_PRIVATE_KEY, {
    algorithm: "RS256"
  });

  const url = `https://pay.google.com/gp/v/save/${token}`;

  res.redirect(url);
}
