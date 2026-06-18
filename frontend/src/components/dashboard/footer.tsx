import { Container } from '@mantine/core';

import { BrandFooter } from '@components/navbar/_brand';
import classes from './footer.module.css';

export function DashboardFooter() {
  return (
    <div className={classes.footer}>
      <Container className={classes.inner}>
        <BrandFooter />
      </Container>
    </div>
  );
}
