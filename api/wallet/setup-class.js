const { google } = require("googleapis");

module.exports = async function handler(req, res) {
  // Proteger con un secreto simple para que no lo ejecute cualquiera
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

    // Autenticación con service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    const client = await auth.getClient();
    const classId = `${process.env.ISSUER_ID}.tactika_auto`;

    const classPayload = {
      id: classId,
      issuerName: "Tactika, Agente de Seguros",
      reviewStatus: "UNDER_REVIEW",

      // ── Diseño visual ──
      hexBackgroundColor: "#2C3228",

      // Logo circular (Tactika isotipo)
      logo: {
        sourceUri: {
          uri: "https://credencial.tactika.mx/assets/logo-tactikatik.png",
        },
        contentDescription: {
          defaultValue: {
            language: "es",
            value: "Tactika",
          },
        },
      },

      // ── Layout del frente del pass ──
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              // Fila 1: Póliza (izquierda) + Contratante (derecha)
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['poliza']",
                      },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['contratante']",
                      },
                    ],
                  },
                },
              },
            },
            {
              // Fila 2: Serie (izquierda) + Color (derecha)
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['serie']",
                      },
                    ],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [
                      {
                        fieldPath: "object.textModulesData['color']",
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };

    // Intentar actualizar la clase existente
    try {
      const updateUrl = `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`;

      const updateResponse = await client.request({
        url: updateUrl,
        method: "PUT",
        data: classPayload,
      });

      return res.status(200).json({
        message: "Clase actualizada correctamente",
        classId: classId,
        data: updateResponse.data,
      });
    } catch (updateError) {
      // Si no existe (404), la creamos
      if (updateError.response && updateError.response.status === 404) {
        const createUrl =
          "https://walletobjects.googleapis.com/walletobjects/v1/genericClass";

        const createResponse = await client.request({
          url: createUrl,
          method: "POST",
          data: classPayload,
        });

        return res.status(201).json({
          message: "Clase creada correctamente",
          classId: classId,
          data: createResponse.data,
        });
      }

      throw updateError;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message,
      details: error.response ? error.response.data : null,
    });
  }
};
