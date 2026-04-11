const jwt = require("jsonwebtoken");

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
            id: `${process.env.ISSUER_ID}.${id}`,
            classId: `${process.env.ISSUER_ID}.tactika_auto`,
            state: "ACTIVE",

            // ── Frente del pass ──
            // cardTitle: aparece arriba del todo (nombre del vehículo)
            cardTitle: {
              defaultValue: {
                language: "es",
                value: poliza.vehiculo || "Vehículo asegurado"
              }
            },

            // header: línea principal visible en la lista de passes
            header: {
              defaultValue: {
                language: "es",
                value: `Seguro Auto · ${aseguradora.nombre || "Aseguradora"}`
              }
            },

            // subheader: vigencia debajo del header
            subheader: {
              defaultValue: {
                language: "es",
                value: poliza.vigencia_texto || ""
              }
            },

            // ── Logo (circular en Google Wallet) ──
            logo: {
              sourceUri: {
                uri: "https://credencial.tactika.mx/assets/logo-tactikatik.png"
              },
              contentDescription: {
                defaultValue: {
                  language: "es",
                  value: "Tactika"
                }
              }
            },

            // ── Color de fondo (verde oscuro Tactika) ──
            hexBackgroundColor: "#2C3228",

            // ── Campos de detalle (4 campos: Póliza, Contratante, Serie, Color) ──
            textModulesData: [
              {
                id: "poliza",
                header: "Póliza",
                body: poliza.poliza || id
              },
              {
                id: "contratante",
                header: "Contratante",
                body: poliza.contratante || ""
              },
              {
                id: "serie",
                header: "Serie",
                body: poliza.serie || ""
              },
              {
                id: "color",
                header: "Color",
                body: (poliza.color || "").trim() || "—"
              }
            ],

            // ── Vigencia (controla la expiración del pass) ──
            validTimeInterval: {
              start: {
                date: poliza.vigencia_inicio
              },
              end: {
                date: poliza.vigencia_fin
              }
            },

            // ── QR code (abre la credencial web) ──
            barcode: {
              type: "QR_CODE",
              value: poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`
            },

            // ── Links (parte trasera del pass) ──
            linksModuleData: {
              uris: [
                {
                  uri: poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`,
                  description: "Abrir credencial",
                  id: "link_credencial"
                },
                {
                  uri: poliza.pdf_url || poliza.web_url || `https://credencial.tactika.mx/auto/?c=${id}`,
                  description: "Ver póliza",
                  id: "link_poliza"
                },
                {
                  uri: "tel:" + (aseguradora.telefonolink || ""),
                  description: `Reportar siniestro · ${aseguradora.telefono_siniestros || ""}`,
                  id: "link_siniestro"
                },
                {
                  uri: "https://wa.me/message/HWHNU3PT7TYXG1",
                  description: "Contactar agente · Tactika",
                  id: "link_agente"
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
