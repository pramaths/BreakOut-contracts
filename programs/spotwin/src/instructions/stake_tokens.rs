use anchor_lang::prelude::*;
use crate::state::stake::StakeAccount;
use crate::constants::LOCK_PERIOD_SLOTS;
use anchor_spl::token::{self, Transfer, TokenAccount, Token};

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer  = staker,
        space  = StakeAccount::LEN,
        seeds  = [b"stake", staker.key().as_ref()],
        bump
    )]
    pub stake_acct: Account<'info, StakeAccount>,

    #[account(
        mut,
        seeds = [b"stake_vault"],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    /// CHECK: this is the PDA authority for the stake_vault;  
    /// only used with `invoke_signed` to move tokens in/out.
    #[account(
        seeds = [b"stake_vault_auth"],
        bump,
    )]
    pub stake_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub staker_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


pub fn handler(
    ctx: Context<StakeTokens>,
    amount: u64,
) -> Result<()> {
    let now = Clock::get()?.slot;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.staker_ata.to_account_info(),
            to:        ctx.accounts.stake_vault.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    let acct = &mut ctx.accounts.stake_acct;
    acct.owner      = ctx.accounts.staker.key();
    acct.amount     = acct.amount.checked_add(amount).unwrap();
    acct.start_slot = now;

    Ok(())
}
