import type { MemberStatus, UpisnicaValue } from '@prana/shared';
import { type ReactNode, useState } from 'react';
import logo from '../assets/prana-mark.png';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Choice,
  ClassTable,
  EmptyState,
  Input,
  LangSwitch,
  MemberProfile,
  MemberRow,
  MembershipCard,
  Notice,
  PageHeader,
  Sidebar,
  Stat,
  StatusChip,
  Tag,
  Toast,
  UpisnicaForm,
} from '../components';
import { useLang } from '../i18n';
import styles from './DemoPage.module.css';

// Sample data only. Names, numbers and teachers are not real.
const STATUSES: MemberStatus[] = ['active', 'expiring', 'unpaid', 'frozen', 'trial'];

const SAMPLE_MEMBER: UpisnicaValue = {
  name: 'Ana Horvat',
  email: 'ana.horvat@example.com',
  phone: '091 234 5678',
  dob: '14.03.1988.',
  student: true,
  plan: '2x',
  health: true,
  healthText: 'Hernija L5, izbjegavati duboke pretklone.',
  consent: true,
  news: true,
};

function Demo({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className={styles.demo}>
      <h2 className={styles.demoName}>{name}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

/** M0 demo: every component in the library with each of its variants. */
export function DemoPage() {
  const { lang, setLang, t } = useLang();
  const [page, setPage] = useState('members');
  const [checked, setChecked] = useState(true);
  const [yesNo, setYesNo] = useState(false);
  const [plan, setPlan] = useState('2x');
  const [draft, setDraft] = useState<UpisnicaValue>(SAMPLE_MEMBER);
  const [saved, setSaved] = useState<string | null>(null);

  const langCode = lang.toUpperCase();
  const onLang = (code: string) => setLang(code === 'EN' ? 'en' : 'hr');

  const nav = [
    { id: 'overview', label: t('nav.overview') },
    { id: 'schedule', label: t('nav.schedule') },
    { id: 'offerings', label: t('nav.offerings') },
    { id: 'members', label: t('nav.members') },
    { id: 'plans', label: t('nav.plans') },
    { id: 'payments', label: t('nav.payments') },
  ];

  return (
    <div className={styles.shell}>
      <Sidebar items={nav} active={page} onSelect={setPage} logoSrc={logo} lang={langCode} onLang={onLang} />
      <main className={styles.main}>
        <div className={styles.content}>
          <Demo name="PageHeader">
            <PageHeader title="Članovi">
              <Button>Novi član</Button>
            </PageHeader>
          </Demo>

          <Demo name="Button">
            <Row>
              <Button>Novi član</Button>
              <Button variant="secondary">Prodaj kartu</Button>
              <Button variant="ghost">Odustani</Button>
              <Button variant="attention">Označi plaćeno</Button>
            </Row>
            <Row>
              <Button size="sm">Novi član</Button>
              <Button size="sm" variant="secondary">Prodaj kartu</Button>
              <Button size="sm" variant="ghost">Odustani</Button>
              <Button size="sm" variant="attention">Označi plaćeno</Button>
            </Row>
            <Row>
              <Button disabled>Novi član</Button>
              <Button variant="secondary" disabled>Prodaj kartu</Button>
              <Button variant="ghost" disabled>Odustani</Button>
              <Button variant="attention" disabled>Označi plaćeno</Button>
            </Row>
          </Demo>

          <Demo name="Input">
            <Card>
              <div className={styles.grid}>
                <Input label="Ime i prezime" defaultValue="Ana Horvat" />
                <Input label="Datum rođenja" placeholder="dd.mm.gggg." />
                <Input label="E-mail" defaultValue="ana.horvat@" error="Unesite ispravnu e-mail adresu." />
                <Input label="Broj mobitela" defaultValue="091 234 5678" hint="Koristi se samo za obavijesti o satu." />
                <Input label="Mjesto" readOnly value="Varaždin" />
                <Input label="Molimo navedite" multiline rows={3} defaultValue="Hernija L5, izbjegavati duboke pretklone." />
              </div>
            </Card>
          </Demo>

          <Demo name="Checkbox">
            <Card>
              <Checkbox checked={checked} onChange={setChecked} required>
                Potvrđujem da su navedeni podaci točni.
              </Checkbox>
              <Checkbox checked={false}>Želim primati obavijesti e-mailom.</Checkbox>
              <Checkbox checked={false} required invalid>
                Potvrđujem da su navedeni podaci točni.
              </Checkbox>
            </Card>
          </Demo>

          <Demo name="Choice">
            <Card>
              <Choice
                value={yesNo}
                onChange={setYesNo}
                options={[
                  { value: false, label: 'NE' },
                  { value: true, label: 'DA' },
                ]}
              />
              <Choice
                layout="grid"
                columns={2}
                value={plan}
                onChange={setPlan}
                options={[
                  { value: '1x', label: t('plan.1x'), sub: t('plan.1x.sub') },
                  { value: '2x', label: t('plan.2x'), sub: t('plan.2x.sub') },
                  { value: '3x', label: t('plan.3x'), sub: t('plan.3x.sub') },
                  { value: 'unl', label: t('plan.unl'), sub: t('plan.unl.sub') },
                ]}
              />
            </Card>
          </Demo>

          <Demo name="LangSwitch">
            <Row>
              <LangSwitch value={langCode} onChange={onLang} />
              <span className={styles.onInk}>
                <LangSwitch dark value={langCode} onChange={onLang} />
              </span>
            </Row>
          </Demo>

          <Demo name="Avatar">
            <Row>
              <Avatar name="Ana Horvat" />
              <Avatar name="Marko Kovač" size={52} />
              <Avatar name="Željka" />
            </Row>
          </Demo>

          <Demo name="StatusChip">
            <Row>
              {STATUSES.map((s) => (
                <StatusChip key={s} status={s} />
              ))}
              <StatusChip status="expiring">Ističe za 3 dana</StatusChip>
            </Row>
          </Demo>

          <Demo name="Tag">
            <Row>
              <Tag kind="plan">2× tjedno</Tag>
              <Tag kind="flag">Student / umirovljenik</Tag>
              <Tag kind="health">Kralježnica · L5</Tag>
              <Tag kind="neutral">Newsletter</Tag>
            </Row>
          </Demo>

          <Demo name="Card">
            <div className={styles.grid}>
              <Card title="Članarina">Bijela površina s tankim obrubom, bez sjene.</Card>
              <Card overline="Uplate" padding={20}>
                Mala kartica s natpisom iznad sadržaja.
              </Card>
            </div>
          </Demo>

          <Demo name="Stat">
            <div className={styles.stats}>
              <Card padding={20}>
                <Stat label="Aktivni članovi" value={42} />
              </Card>
              <Card padding={20}>
                <Stat label="Ističu ovaj tjedan" value={2} />
              </Card>
              <Card padding={20}>
                <Stat label="Dugovanja" value="65,00 €" attention />
              </Card>
              <Card padding={20}>
                <Stat label="Uplate u listopadu" value="1.180,00 €" />
              </Card>
            </div>
          </Demo>

          <Demo name="MembershipCard">
            <div className={styles.grid}>
              <MembershipCard plan="2× tjedno" used={5} total={8} renewal="01.11." />
              <MembershipCard plan="3× tjedno" used={12} total={12} />
              <MembershipCard plan="Neograničeno" used={14} total={0} period="01.10.–31.10." />
            </div>
          </Demo>

          <Demo name="MemberRow">
            <Card padding={0} style={{ gap: 0, overflow: 'hidden' }}>
              <MemberRow name="Ana Horvat" sub="2× tjedno · 6/8 dolazaka · zadnji dolazak 09.10." status="expiring" statusLabel="Ističe za 3 dana" onClick={() => {}} />
              <MemberRow name="Marko Kovač" sub="1× tjedno · 65,00 €" status="unpaid" onClick={() => {}} />
              <MemberRow name="Iva Babić" sub="3× tjedno · 9/12 dolazaka · zadnji dolazak 10.10." note="Kralježnica · L5" status="active" onClick={() => {}} />
              <MemberRow name="Petra Novak" sub="Neograničeno · zamrznuto do 01.11." status="frozen" />
              <MemberRow name="Luka Jurić" sub="Proba · 0/1 dolazak" status="trial" compact />
            </Card>
          </Demo>

          <Demo name="ClassTable">
            <ClassTable
              date="Ponedjeljak, 12.10."
              classes={[
                { time: '09:00–10:00', title: 'Joga za kralježnicu', color: 'var(--class-spine)', teacher: 'Mario', booked: 5, capacity: 12 },
                { time: '17:00–19:00', title: 'Ashtanga Mysore', color: 'var(--class-ashtanga)', teacher: 'Mario', booked: 8, capacity: 12 },
                { time: '19:15–20:15', title: 'Restorativna joga', color: 'var(--class-restorative)', teacher: 'Mario', booked: 12, capacity: 12, waitlist: 2 },
              ]}
            />
            <ClassTable
              compact
              classes={[
                { time: '18:15–19:30', title: 'Black Lotus Yoga', color: 'var(--class-black-lotus)', teacher: 'Mario', booked: 3, capacity: 10 },
                { time: '19:45–20:15', title: 'Pranayama & meditacija', color: 'var(--class-pranayama)', teacher: 'Mario', booked: 4, capacity: 10 },
              ]}
            />
          </Demo>

          <Demo name="Toast">
            <Row>
              <Toast action="Poništi">Ana Horvat je spremljena kao novi član.</Toast>
              <Toast>Uplata je zabilježena.</Toast>
            </Row>
          </Demo>

          <Demo name="Notice">
            <Notice title="2 neplaćene uplate">Ukupno 70,00 €.</Notice>
          </Demo>

          <Demo name="EmptyState">
            <Card>
              <EmptyState title="Još nema uplata" action={<Button variant="secondary" size="sm">Prodaj kartu</Button>}>
                Kad prodate prvu kartu, ovdje će se pojaviti račun.
              </EmptyState>
            </Card>
          </Demo>

          <Demo name="UpisnicaForm + MemberProfile">
            <div className={styles.columns}>
              <UpisnicaForm
                initial={SAMPLE_MEMBER}
                place="Varaždin"
                onChange={setDraft}
                onSave={(v) => setSaved(v.name)}
                onCancel={() => setSaved(null)}
              />
              <div className={styles.stack}>
                <MemberProfile member={draft} status="active" since="11.10.2026." onEdit={() => {}} />
                <MemberProfile member={{ name: 'Marko Kovač', plan: '1x', phone: '098 765 4321' }} status="unpaid" since="02.09.2026." />
                {saved && (
                  <Toast action="Poništi" onAction={() => setSaved(null)}>
                    {saved} je spremljen/a kao novi član.
                  </Toast>
                )}
              </div>
            </div>
          </Demo>
        </div>
      </main>
    </div>
  );
}
