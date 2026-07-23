import env from '#config/env.js';

/**
 * Servicio de correo electrónico.
 * - Con RESEND_API_KEY: envía vía Resend.
 * - Sin proveedor: deja el enlace en logs (útil en desarrollo).
 */
export class EmailService {
  /**
   * Envía el correo de verificación de cuenta.
   * @returns {Promise<{ prepared: boolean, sent: boolean, provider?: string }>}
   */
  async sendVerificationEmail({ to, token, userName, organizationName }) {
    const verificationUrl = `${env.client.url}/verificar-email?token=${token}`;
    const subject = `Verifica tu correo — ${env.app.name}`;
    const html = this.#buildVerificationHtml({
      userName,
      organizationName,
      verificationUrl,
      expiresInHours: env.verificationTokenExpiresHours,
      appName: env.app.name,
    });
    const text = [
      `Hola ${userName || ''},`,
      '',
      `Confirma tu correo para activar ${organizationName || env.app.name}.`,
      `Abre este enlace (válido ${env.verificationTokenExpiresHours} h):`,
      verificationUrl,
      '',
      `Si no creaste esta cuenta, ignora este mensaje.`,
    ].join('\n');

    if (env.isDevelopment || !env.email.resendApiKey) {
      console.info('[EmailService] Correo de verificación preparado:', {
        to,
        verificationUrl,
        provider: env.email.resendApiKey ? 'resend' : 'log-only',
      });
    }

    if (!env.email.resendApiKey) {
      return { prepared: true, sent: false, provider: 'none', verificationUrl };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.email.from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error('[EmailService] Resend error:', response.status, body);

        let resendMessage = '';
        try {
          resendMessage = JSON.parse(body)?.message || '';
        } catch {
          resendMessage = body;
        }

        const isTestingRestriction =
          response.status === 403 &&
          /only send testing emails to your own email/i.test(resendMessage);

        // El enlace solo va al correo (y a logs del servidor). Nunca se expone al cliente.
        if (env.isDevelopment) {
          console.info('[EmailService] Enlace de verificación (solo logs):', verificationUrl);
        }

        const err = new Error(
          isTestingRestriction
            ? 'Con Resend gratis (sin dominio) solo puedes registrarte con el correo de tu cuenta Resend. El enlace de confirmación se envía únicamente por correo electrónico.'
            : `No se pudo enviar el correo de verificación (${response.status}). ${resendMessage || 'Revisa RESEND_API_KEY y EMAIL_FROM.'}`,
        );
        err.resendStatus = response.status;
        err.resendBody = body;
        throw err;
      }

      const result = await response.json().catch(() => ({}));
      return {
        prepared: true,
        sent: true,
        provider: 'resend',
        id: result.id ?? null,
      };
    } catch (error) {
      if (error.resendStatus) throw error;
      console.error('[EmailService] Fallo al enviar:', error);
      throw new Error('No se pudo conectar con Resend para enviar el correo de verificación.');
    }
  }

  async sendActivationRequestReceived({ to, contactName, planName, company }) {
    const subject = 'Hemos recibido tu solicitud';
    const html = this.#buildSimpleHtml({
      title: 'Solicitud recibida',
      greeting: `Hola ${contactName || ''},`,
      paragraphs: [
        `Gracias por elegir ${env.app.name}.`,
        `Hemos recibido tu solicitud de activación del plan <strong>${planName}</strong> para <strong>${company}</strong>.`,
        'Nuestro equipo revisará tu solicitud y se pondrá en contacto contigo lo antes posible.',
        'Mientras tanto podrás disfrutar del período de prueba de tu plan.',
      ],
    });
    const text = [
      `Hola ${contactName || ''},`,
      '',
      `Gracias por elegir ${env.app.name}.`,
      `Hemos recibido tu solicitud de activación del plan ${planName} para ${company}.`,
      'Nuestro equipo revisará tu solicitud y se pondrá en contacto contigo lo antes posible.',
      'Mientras tanto podrás disfrutar del período de prueba de tu plan.',
    ].join('\n');
    return this.#send({ to, subject, html, text, logLabel: 'activation-received' });
  }

  async sendActivationRequestToAdmin({ to, request, planName, organizationName }) {
    const subject = `Nueva solicitud de activación — ${organizationName || request.company}`;
    const lines = [
      `Empresa: ${request.company}`,
      `Organización: ${organizationName || '—'}`,
      `Plan: ${planName}`,
      `Contacto: ${request.contactName}`,
      `Correo: ${request.email}`,
      `Teléfono: ${request.phone}`,
      `Ciudad: ${request.city}`,
      `Vehículos diarios: ${request.dailyVehicles ?? '—'}`,
      `Sedes: ${request.branches ?? '—'}`,
      `Horario: ${request.schedule || '—'}`,
      `Comentarios: ${request.comments || '—'}`,
    ];
    const html = this.#buildSimpleHtml({
      title: 'Nueva solicitud de activación',
      greeting: 'Hola,',
      paragraphs: [
        'Se recibió una nueva solicitud de activación de suscripción.',
        `<pre style="white-space:pre-wrap;font-family:inherit;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0">${lines.join('\n')}</pre>`,
      ],
    });
    return this.#send({
      to,
      subject,
      html,
      text: ['Nueva solicitud de activación', '', ...lines].join('\n'),
      logLabel: 'activation-admin',
    });
  }

  async sendActivationApproved({
    to,
    contactName,
    planName,
    startDate,
    endDate,
    supportEmail,
  }) {
    const start = startDate ? new Date(startDate).toLocaleDateString('es-CO') : '—';
    const end = endDate ? new Date(endDate).toLocaleDateString('es-CO') : '—';
    const subject = 'Tu plan ya fue activado';
    const html = this.#buildSimpleHtml({
      title: 'Suscripción activada',
      greeting: `Hola ${contactName || ''},`,
      paragraphs: [
        `Tu plan <strong>${planName}</strong> ya fue activado.`,
        `Ya puedes utilizar ${env.app.name} sin restricciones.`,
        `Vigencia: ${start} — ${end}.`,
        supportEmail ? `Si necesitas ayuda, escribe a ${supportEmail}.` : '',
      ].filter(Boolean),
    });
    return this.#send({
      to,
      subject,
      html,
      text: [
        `Hola ${contactName || ''},`,
        '',
        `Tu plan ${planName} ya fue activado.`,
        `Ya puedes utilizar ${env.app.name} sin restricciones.`,
        `Vigencia: ${start} — ${end}.`,
      ].join('\n'),
      logLabel: 'activation-approved',
    });
  }

  async sendActivationRejected({
    to,
    contactName,
    planName,
    supportEmail,
    supportWhatsapp,
    reason,
  }) {
    const subject = 'Actualización sobre tu solicitud de activación';
    const contactBits = [
      supportEmail ? `Correo: ${supportEmail}` : null,
      supportWhatsapp ? `WhatsApp: ${supportWhatsapp}` : null,
    ].filter(Boolean);
    const html = this.#buildSimpleHtml({
      title: 'Solicitud no aprobada',
      greeting: `Hola ${contactName || ''},`,
      paragraphs: [
        `Lamentamos informarte que tu solicitud de activación del plan <strong>${planName}</strong> no pudo ser aprobada en este momento.`,
        reason ? `Motivo: ${reason}` : '',
        contactBits.length
          ? `Puedes contactar a soporte: ${contactBits.join(' · ')}`
          : 'Puedes contactar a nuestro equipo de soporte para más información.',
      ].filter(Boolean),
    });
    return this.#send({
      to,
      subject,
      html,
      text: [
        `Hola ${contactName || ''},`,
        '',
        `Tu solicitud de activación del plan ${planName} no fue aprobada.`,
        reason ? `Motivo: ${reason}` : '',
        ...contactBits,
      ]
        .filter(Boolean)
        .join('\n'),
      logLabel: 'activation-rejected',
    });
  }

  async #send({ to, subject, html, text, logLabel }) {
    if (env.isDevelopment || !env.email.resendApiKey) {
      console.info(`[EmailService] ${logLabel}:`, { to, subject });
    }

    if (!env.email.resendApiKey) {
      return { prepared: true, sent: false, provider: 'none' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.email.from,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[EmailService] Resend error (${logLabel}):`, response.status, body);
        return { prepared: true, sent: false, provider: 'resend', error: body };
      }

      const result = await response.json().catch(() => ({}));
      return { prepared: true, sent: true, provider: 'resend', id: result.id ?? null };
    } catch (error) {
      console.error(`[EmailService] Fallo ${logLabel}:`, error);
      return { prepared: true, sent: false, provider: 'resend', error: error.message };
    }
  }

  #buildSimpleHtml({ title, greeting, paragraphs }) {
    const body = paragraphs
      .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`)
      .join('');
    return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="margin:0 0 16px;line-height:1.5">${greeting}</p>
    ${body}
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">${env.app.name}</p>
  </div>
</body>
</html>`;
  }

  #buildVerificationHtml({ userName, organizationName, verificationUrl, expiresInHours, appName }) {
    const safeName = userName || 'hola';
    const org = organizationName || appName;
    return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
    <h1 style="font-size:20px;margin:0 0 12px">Verifica tu correo</h1>
    <p style="margin:0 0 16px;line-height:1.5">Hola ${safeName}, confirma tu correo para activar <strong>${org}</strong> en ${appName}.</p>
    <p style="margin:0 0 20px">
      <a href="${verificationUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">
        Verificar correo
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5">El enlace vence en ${expiresInHours} horas. Si el botón no funciona, copia esta URL:</p>
    <p style="margin:0;font-size:12px;word-break:break-all;color:#475569">${verificationUrl}</p>
  </div>
</body>
</html>`;
  }
}

export const emailService = new EmailService();
