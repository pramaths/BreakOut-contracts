use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, TokenAccount, Token};
use crate::state::stake::StakeAccount;
use crate::constants::LOCK_PERIOD_SLOTS;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct UnstakeTokens<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    
    #[account(
        mut,
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
        bump
    )]
    pub stake_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub staker_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<UnstakeTokens>,
    amount: u64,
) -> Result<()> {
    let now = Clock::get()?.slot;
    let acct = &mut ctx.accounts.stake_acct;

    let unlock_slot = acct.start_slot.checked_add(LOCK_PERIOD_SLOTS)
    .ok_or(ErrorCode::NumericalOverflow)?;
    require!(now >= unlock_slot, ErrorCode::StakeLocked);

    require!(
        amount > 0 && amount <= acct.amount,
        ErrorCode::InvalidUnstakeAmount
    );

    let auth_bump = ctx.bumps.stake_authority;
    let signer_seeds: &[&[u8]] = &[
        b"stake_vault_auth".as_ref(),       
        &[auth_bump][..],                   
    ];
    let signer = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from:      ctx.accounts.stake_vault.to_account_info(),
            to:        ctx.accounts.staker_ata.to_account_info(),
            authority: ctx.accounts.stake_authority.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi_ctx, amount)?;

    acct.amount = acct.amount.checked_sub(amount).unwrap();
    if acct.amount == 0 {
        acct.start_slot = 0;
    }

    Ok(())
}
