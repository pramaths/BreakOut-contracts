use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction()]
pub struct InitializeStake<'info> {
    /// Whoever pays the rent (you, or a deployer script)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The SPL mint users will stake (USDC / SPOT)
    pub pool_mint: Account<'info, Mint>,

    /// PDA that will hold all staked tokens
    #[account(
        init,
        payer = payer,
        token::mint = pool_mint,
        token::authority = stake_authority,
        seeds = [b"stake_vault"],
        bump
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the vault
    #[account(
        seeds = [b"stake_vault_auth"],
        bump
    )]
    pub stake_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}


pub fn handler(_ctx: Context<InitializeStake>) -> Result<()> {
    Ok(())
}