import { ConfigService } from '@nestjs/config';
import { EmailService, POSTAL_ADDRESS_MISSING } from './email.service';

function make(env: Record<string, string> = {}) {
  const service = new EmailService(new ConfigService(env));
  const send = jest.fn(async (_payload: any) => ({ data: { id: 'e1' }, error: null as unknown }));
  (service as any).resendInstance = { emails: { send } };
  return { service, send };
}

const campaign = {
  to: 'm@example.com',
  subject: 'News',
  html: '<p>Hello</p>',
  unsubscribeUrl: 'https://x.test/unsubscribe?token=a.b',
  oneClickUrl: 'https://x.test/api/unsubscribe?token=a.b',
};

describe('EmailService compliance', () => {
  it('refuses a campaign email without a postal address and contacts nobody', async () => {
    const { service, send } = make();
    await expect(service.sendCampaignEmail(campaign)).rejects.toThrow(POSTAL_ADDRESS_MISSING);
    expect(send).not.toHaveBeenCalled();
  });

  it('treats a blank or quoted-blank address as unset', () => {
    expect(make({ EMAIL_POSTAL_ADDRESS: '   ' }).service.postalAddress).toBeNull();
    expect(make({ EMAIL_POSTAL_ADDRESS: '""' }).service.postalAddress).toBeNull();
  });

  it('adds the escaped address, the link and one-click headers', async () => {
    const { service, send } = make({ EMAIL_POSTAL_ADDRESS: '1 Main St <Suite 2>, Chicago' });
    await service.sendCampaignEmail(campaign);
    const payload = send.mock.calls[0][0];
    expect(payload.html).toContain('1 Main St &lt;Suite 2&gt;, Chicago');
    expect(payload.html).toContain('href="https://x.test/unsubscribe?token=a.b"');
    expect(payload.headers).toEqual({
      'List-Unsubscribe': '<https://x.test/api/unsubscribe?token=a.b>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('puts the footer inside the body of a full HTML template', async () => {
    const { service, send } = make({ EMAIL_POSTAL_ADDRESS: '1 Main St' });
    await service.sendCampaignEmail({ ...campaign, html: '<html><body><p>Hi</p></BODY></html>' });
    const { html } = send.mock.calls[0][0];
    expect(html.indexOf('1 Main St')).toBeLessThan(html.indexOf('</BODY>'));
  });

  it('throws when Resend returns an error, so it is not counted as sent', async () => {
    const { service, send } = make({ EMAIL_POSTAL_ADDRESS: '1 Main St' });
    send.mockResolvedValueOnce({ data: null as any, error: { name: 'rate_limit_exceeded' } });
    await expect(service.sendCampaignEmail(campaign)).rejects.toThrow('rate_limit_exceeded');
  });

  describe('service messages', () => {
    it('still send without an address, and carry no dead unsubscribe link', async () => {
      const { service, send } = make();
      await service.sendWelcomeEmail('m@example.com', 'Amal');
      const { html } = send.mock.calls[0][0];
      expect(html).not.toContain('/unsubscribe');
      expect(html).toContain('service message');
    });

    it('show the address once it is set', async () => {
      const { service, send } = make({ EMAIL_POSTAL_ADDRESS: '1 Main St' });
      await service.sendWelcomeEmail('m@example.com', 'Amal');
      expect(send.mock.calls[0][0].html).toContain('1 Main St');
    });
  });
});
