cconst jwt = require("jsonwebtoken");

module.exports = async function handler(req, res) {
  try {
    const { id } = req.query;

    const [polizasResp, aseguradorasResp] = await Promise.all([
      fetch("https://credencial.tactika.mx/data/auto.json"),
      fetch("https://credencial.tactika.mx/data/aseguradoras-auto.json")
    ]);

    if (!polizasResp.ok) {
      return res.status(500).json({ error: "No se pudo leer auto.json del sitio" });
    }

    if (!aseguradorasResp.ok) {
      return res.status(500).json({ error: "No se pudo leer aseguradoras-auto.json del sitio" });
    }

    const polizas = await polizasResp.json();
    const aseguradoras = await aseguradorasResp.json();

    const poliza = polizas[id];
    if (!poliza) {
      return res.status(404).json({ error: "Póliza no encontrada" });
    }

    const aseguradora = aseguradoras[poliza.aseguradora_id];
    if (!aseguradora) {
      return res.status(404).json({ error: "Aseguradora no encontrada" });
    }

    if (!poliza.vigencia_inicio || !poliza.vigencia_fin) {
      return res.status(400).json({
        error: "Faltan vigencia_inicio o vigencia_fin en auto.json"
      });
    }

    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

    const payload = {
      iss: process.env.GOOGLE_CLIENT_EMAIL,
      aud: "google",
      typ: "savetowallet",
      payload: {
        genericObjects: [
          {
            id: `${process.env.ISSUER_ID}.${id}.v22`,
            classId: `${process.env.ISSUER_ID}.tactika_auto`,
            state: "ACTIVE",

            cardTitle: {
              defaultValue: {
                language: "es",
                value: poliza.vehiculo || "Vehículo asegurado"
              }
            },
            logo: {
              sourceUri: {
                uri: "https://credencial.tactika.mx/logo-tactikatik.png"
              }
            },
            header: {
              defaultValue: {
                language: "es",
                value: `Seguro Auto • ${aseguradora.nombre || "Aseguradora"}`
              }
            },

            subheader: {
              defaultValue: {
                language: "es",
                value: poliza.vigencia_texto || ""
              }
            },

            heroImage: {
              sourceUri: {
                uri: "https://credencial.tactika.mx/preview-tactika-auto.jpg"
              }
            },

            hexBackgroundColor: "#1F2A23",

            textModulesData: [
              {
                header: "Póliza",
                body: poliza.poliza || id
              },
              {
                header: "Contratante",
                body: poliza.contratante || ""
              },
              {
                header: "Serie",
                body: poliza.serie || ""
              },
              {
                header: "Color",
                body: poliza.color || ""
              }
            ],

            validTimeInterval: {
              start: {
                date: poliza.vigencia_inicio
              },
              end: {
                date: poliza.vigencia_fin
              }
            },

            barcode: {
              type: "QR_CODE",
              value: poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`
            },

            linksModuleData: {
              uris: [
                {
                  uri: poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`,
                  description: "Abrir credencial"
                },
                {
                  uri: poliza.pdf_url || poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`,
                  description: "Ver póliza"
                },
                {
                  uri: "tel:" + (aseguradora.telefonolink || ""),
                  description: "Reportar siniestro"
                }
              ]
            }
          }
        ]
      }
    };

    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256"
    });

    const url = `https://pay.google.com/gp/v/save/${token}`;
    return res.redirect(url);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
